import { Inject, Injectable, Logger } from '@nestjs/common';
import { Period } from '@/shared/domain/period.value-object';
import { getErrorMessage } from '@/shared/utils/getErrorMessage';
import { ROAPP_GATEWAY } from '@/domains/service/integrations/roapp-gateway/roapp-gateway.port';
import type { RoappGateway } from '@/domains/service/integrations/roapp-gateway/roapp-gateway.port';
import { PRODUCT_CATEGORY_REPOSITORY } from '../ports/product-category/product-category.port';
import type { ProductCategoryRepositoryPort } from '../ports/product-category/product-category.port';
import { WAREHOUSE_REPOSITORY } from '../ports/warehouse/warehouse.port';
import type { WarehouseRepositoryPort } from '../ports/warehouse/warehouse.port';
import { GOODS_TURNOVER_REPORT_LINE_REPOSITORY } from '../ports/goods-turnover-report/goods-turnover-report-line.port';
import type { GoodsTurnoverReportLineRepositoryPort } from '../ports/goods-turnover-report/goods-turnover-report-line.port';
import { GoodsTurnoverReport } from '../../domain/entities/goods-turnover-report/goods-turnover-report.entity';
import { GoodsTurnoverReportLine } from '../../domain/entities/goods-turnover-report/goods-turnover-report-line.entity';
import { GoodsFlowMetric } from '../../domain/value-objects/goods-flow-metric.value-object';

// Безопасный дефолт параллелизма вызовов getGoodsFlowReport (design.md,
// риск "Комбинаторика категория × склад"; warehouse-api-finding.md, задача
// 1.2/9.3): реальную задержку кастомного эндпоинта rm.murygin.tech замерить
// в песочнице задачи 1.2 не удалось (стабильный 502 Bad Gateway — сетевой
// блокер окружения, не специфика метода), поэтому взят предложенный там
// консервативный дефолт — нижняя граница диапазона 3-5, до появления
// реальных цифр со стейджа/прода.
export const GOODS_FLOW_REPORT_CONCURRENCY = 3;

interface CategoryWarehousePair {
    categoryId: number;
    warehouseId: number;
}

// Application-сервис построения отчёта по оборачиваемости за один
// календарный месяц (design.md D4) — рекурсивно (за счёт плоского перебора,
// иерархия categoryId/parentId сервису не важна: "рекурсивный обход дерева"
// сводится к тому, что справочник категорий уже включает узлы любого уровня
// вложенности, см. ProductCategoryRepositoryPort.findAll) обходит все
// категории справочника товаров × все склады и для каждой пары делает один
// вызов ROAPP_GATEWAY.fetchGoodsFlowReport за диапазон дат месяца
// (spec: service/goods-turnover, "Отчёт покрывает все категории и все
// вложенные категории", "Отчёт строится отдельно по каждому складу").
// Только СТРОИТ отчёт в памяти — сохранение (GOODS_TURNOVER_REPORT_LINE_REPOSITORY.replaceAll)
// остаётся на вызывающей стороне (крон задачи 11, обработчик закрытия
// периода задачи 12), это не смешивается с построением здесь.
@Injectable()
export class BuildGoodsTurnoverReportService {
    private readonly logger = new Logger(BuildGoodsTurnoverReportService.name);

    constructor(
        @Inject(PRODUCT_CATEGORY_REPOSITORY)
        private readonly categoryRepository: ProductCategoryRepositoryPort,
        @Inject(WAREHOUSE_REPOSITORY)
        private readonly warehouseRepository: WarehouseRepositoryPort,
        @Inject(GOODS_TURNOVER_REPORT_LINE_REPOSITORY)
        private readonly lineRepository: GoodsTurnoverReportLineRepositoryPort,
        @Inject(ROAPP_GATEWAY)
        private readonly roappGateway: RoappGateway,
    ) {}

    async build(period: string): Promise<GoodsTurnoverReport> {
        const periodVO = Period.create(period);
        const { from, to } = periodVO.getBounds();

        const [categories, warehouses, previousLines] = await Promise.all([
            this.categoryRepository.findAll(),
            this.warehouseRepository.findAll(),
            // design.md D4: остаток прошлого месяца читается из уже
            // сохранённых строк той же пары категория-склад — без
            // дополнительных вызовов ERP.
            this.lineRepository.findByPeriod(periodVO.previous().getValue()),
        ]);

        const previousStockSumByKey = new Map<string, number>();
        for (const previousLine of previousLines) {
            previousStockSumByKey.set(
                previousLine.categoryWarehouseKey,
                previousLine.stock.sum,
            );
        }

        const pairs: CategoryWarehousePair[] = [];
        for (const category of categories) {
            for (const warehouse of warehouses) {
                pairs.push({
                    categoryId: category.getId(),
                    warehouseId: warehouse.getId(),
                });
            }
        }

        const lines: GoodsTurnoverReportLine[] = [];
        await runWithConcurrencyLimit(
            pairs,
            GOODS_FLOW_REPORT_CONCURRENCY,
            async (pair) => {
                const line = await this.buildLine(
                    period,
                    pair,
                    from,
                    to,
                    previousStockSumByKey.get(
                        `${pair.categoryId}:${pair.warehouseId}`,
                    ) ?? null,
                );
                if (line) {
                    lines.push(line);
                }
            },
        );

        return GoodsTurnoverReport.create({ period, lines });
    }

    // Одна пара категория-склад. Сбой вызова ERP на отдельной паре не
    // должен прерывать построение отчёта целиком (design.md D6, "частичный
    // успех лучше, чем полный сбой") — ошибка логируется, пара пропускается
    // (null), build() продолжает остальные пары.
    private async buildLine(
        period: string,
        pair: CategoryWarehousePair,
        from: Date,
        to: Date,
        stockPreviousSum: number | null,
    ): Promise<GoodsTurnoverReportLine | null> {
        try {
            const response = await this.roappGateway.fetchGoodsFlowReport({
                startDate: from.getTime(),
                endDate: to.getTime(),
                category_id: pair.categoryId,
                warehouses: [pair.warehouseId],
            });

            const line = GoodsTurnoverReportLine.create({
                period,
                categoryId: pair.categoryId,
                warehouseId: pair.warehouseId,
                outcome: GoodsFlowMetric.create(
                    response.outcome.quantity,
                    response.outcome.sum,
                ),
                stock: GoodsFlowMetric.create(
                    response.stock.quantity,
                    response.stock.sum,
                ),
            });
            // spec: service/goods-turnover, "Позиция отчёта содержит
            // коэффициент оборачиваемости" — считается сразу после сборки
            // строки, а не отдельным проходом.
            line.calcRatio(stockPreviousSum);
            return line;
        } catch (error) {
            this.logger.warn(
                `Не удалось получить данные оборачиваемости за период ${period}: ` +
                    `категория=${pair.categoryId}, склад=${pair.warehouseId} — ` +
                    `${getErrorMessage(error)}`,
            );
            return null;
        }
    }
}

// Пул из не более `limit` "воркеров", каждый последовательно вытягивает
// следующий ещё не обработанный элемент общей очереди — реальное
// ограничение числа одновременно летящих вызовов worker(), а не просто
// нарезка items на чанки по `limit` (чанками самый медленный элемент чанка
// держал бы простаивать уже освободившихся воркеров до конца чанка).
async function runWithConcurrencyLimit<T>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<void>,
): Promise<void> {
    let cursor = 0;
    const workerCount = Math.min(limit, items.length);
    const runners = Array.from({ length: workerCount }, async () => {
        while (cursor < items.length) {
            const item = items[cursor++];
            await worker(item);
        }
    });
    await Promise.all(runners);
}
