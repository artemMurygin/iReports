import { Inject, Injectable } from '@nestjs/common';
import type { GetGoodsTurnoverReportResponse } from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import { GOODS_TURNOVER_REPORT_LINE_REPOSITORY } from '@/domains/service/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report-line.port';
import type { GoodsTurnoverReportLineRepositoryPort } from '@/domains/service/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report-line.port';
import { PRODUCT_CATEGORY_REPOSITORY } from '@/domains/service/modules/warehouse/application/ports/product-category/product-category.port';
import type { ProductCategoryRepositoryPort } from '@/domains/service/modules/warehouse/application/ports/product-category/product-category.port';
import { WAREHOUSE_REPOSITORY } from '@/domains/service/modules/warehouse/application/ports/warehouse/warehouse.port';
import type { WarehouseRepositoryPort } from '@/domains/service/modules/warehouse/application/ports/warehouse/warehouse.port';
import { toGoodsTurnoverReportLineResponse } from '@/domains/service/modules/warehouse/application/mappers/goods-turnover-report/to-goods-turnover-report-line-response';

// Read-side отчёта по оборачиваемости (GET /v1/service/warehouse/
// goods-turnover-report/:period, задача 10, architecture.md
// "GetGoodsTurnoverReportService") — читает уже сохранённые строки периода
// (GOODS_TURNOVER_REPORT_LINE_REPOSITORY.findByPeriod; наполняют их
// BuildGoodsTurnoverReportService/крон/обработчик закрытия — задачи 9/11/12,
// этот сервис только читает) и денормализует каждую строку именем/parentId
// категории и именем склада из справочников — GoodsTurnoverTable (задача 18)
// строит дерево строк прямо из ответа, без отдельного join на фронтенде.
//
// Период без сохранённых строк — валидный пустой список (design.md D5:
// месяц ещё ни разу не пересчитан, либо справочник складов ещё не
// синхронизирован), не ошибка — используется фронтендом для состояния
// «отчёт ещё не пересчитан» (ui-design.md, «Ключевые состояния»). В этом
// случае справочники не запрашиваются вовсе — денормализовать нечего.
@Injectable()
export class GetGoodsTurnoverReportService {
    constructor(
        @Inject(GOODS_TURNOVER_REPORT_LINE_REPOSITORY)
        private readonly lineRepo: GoodsTurnoverReportLineRepositoryPort,
        @Inject(PRODUCT_CATEGORY_REPOSITORY)
        private readonly categoryRepo: ProductCategoryRepositoryPort,
        @Inject(WAREHOUSE_REPOSITORY)
        private readonly warehouseRepo: WarehouseRepositoryPort,
    ) {}

    async get(period: string): Promise<GetGoodsTurnoverReportResponse> {
        const periodValue = Period.create(period).getValue();

        const lines = await this.lineRepo.findByPeriod(periodValue);
        if (lines.length === 0) {
            return { period: periodValue, lines: [] };
        }

        const [categories, warehouses] = await Promise.all([
            this.categoryRepo.findAll(),
            this.warehouseRepo.findAll(),
        ]);
        const categoryById = new Map(
            categories.map((category) => [category.getId(), category]),
        );
        const warehouseById = new Map(
            warehouses.map((warehouse) => [warehouse.getId(), warehouse]),
        );

        return {
            period: periodValue,
            lines: lines.map((line) =>
                toGoodsTurnoverReportLineResponse(
                    line,
                    categoryById.get(line.categoryId),
                    warehouseById.get(line.warehouseId),
                ),
            ),
        };
    }
}
