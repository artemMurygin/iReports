import { withRequestContext } from '@/shared/testing/with-request-context';
import type { RoappGateway } from '@/domains/service/integrations/roapp-gateway/roapp-gateway.port';
import type { GoodsFlowReportResponse } from '@/domains/service/integrations/custom-api-roapp/schemas/goodsFlowReport.schema';
import type { ProductCategoryRepositoryPort } from '../ports/product-category/product-category.port';
import type { WarehouseRepositoryPort } from '../ports/warehouse/warehouse.port';
import type { GoodsTurnoverReportLineRepositoryPort } from '../ports/goods-turnover-report/goods-turnover-report-line.port';
import { ProductCategory } from '../../domain/value-objects/product-category.value-object';
import { Warehouse } from '../../domain/value-objects/warehouse.value-object';
import { GoodsTurnoverReportLine } from '../../domain/entities/goods-turnover-report/goods-turnover-report-line.entity';
import { GoodsFlowMetric } from '../../domain/value-objects/goods-flow-metric.value-object';
import {
    BuildGoodsTurnoverReportService,
    GOODS_FLOW_REPORT_CONCURRENCY,
} from './build-goods-turnover-report.service';

// Полный фейковый RoappGateway (единственная зависимость, помимо трёх
// портов модуля warehouse) — по образцу
// modules/marketing/pricing/application/command/update-service-prices.handler.spec.ts,
// перечисляющего все методы интерфейса, а не Partial-каст.
function buildGateway(
    fetchGoodsFlowReport: RoappGateway['fetchGoodsFlowReport'],
): RoappGateway {
    return {
        fetchEmployees: jest.fn(),
        fetchWarehouses: jest.fn(),
        fetchOrderTypes: jest.fn(),
        fetchOrderStatuses: jest.fn(),
        fetchMarketingSources: jest.fn(),
        fetchServiceCategories: jest.fn(),
        fetchProductCategories: jest.fn(),
        fetchServices: jest.fn(),
        fetchProducts: jest.fn(),
        fetchCreatedOrders: jest.fn(),
        fetchUpdatedOrders: jest.fn(),
        fetchOrdersClosedBetween: jest.fn(),
        fetchOrderItems: jest.fn(),
        fetchServiceBonuses: jest.fn(),
        fetchServiceBonusById: jest.fn(),
        createService: jest.fn(),
        updateServicesFromFile: jest.fn(),
        fetchGoodsFlowReport,
    };
}

const zeroResponse: GoodsFlowReportResponse = {
    outcome: { quantity: 0, sum: 0 },
    stock: { quantity: 0, sum: 0 },
};

function buildCategory(id: number, parentId: number | null = null) {
    return ProductCategory.create({ id, name: `Категория ${id}`, parentId });
}

function buildWarehouse(id: number) {
    return Warehouse.create({ id, name: `Склад ${id}` });
}

function buildService(options: {
    categories: ProductCategory[];
    warehouses: ReturnType<typeof buildWarehouse>[];
    fetchGoodsFlowReport: RoappGateway['fetchGoodsFlowReport'];
    previousLines?: GoodsTurnoverReportLine[];
}) {
    const categoryRepository: ProductCategoryRepositoryPort = {
        findAll: jest.fn().mockResolvedValue(options.categories),
    };
    const warehouseRepository: WarehouseRepositoryPort = {
        findAll: jest.fn().mockResolvedValue(options.warehouses),
    };
    const findByPeriod = jest
        .fn<Promise<GoodsTurnoverReportLine[]>, [string]>()
        .mockResolvedValue(options.previousLines ?? []);
    const lineRepository: GoodsTurnoverReportLineRepositoryPort = {
        findByPeriod,
        replaceAll: jest.fn(),
    };
    const gateway = buildGateway(options.fetchGoodsFlowReport);

    const service = new BuildGoodsTurnoverReportService(
        categoryRepository,
        warehouseRepository,
        lineRepository,
        gateway,
    );

    return {
        service,
        gateway,
        findByPeriod,
        warehouseRepository,
        categoryRepository,
    };
}

describe('BuildGoodsTurnoverReportService', () => {
    // spec: service/goods-turnover — "Отчёт покрывает все категории и все
    // вложенные категории справочника товаров"
    it('строит позицию для категории верхнего уровня и её вложенной подкатегории', async () => {
        await withRequestContext(async () => {
            const { service } = buildService({
                categories: [buildCategory(1), buildCategory(2, 1)],
                warehouses: [buildWarehouse(10)],
                fetchGoodsFlowReport: jest.fn().mockResolvedValue(zeroResponse),
            });

            const report = await service.build('2026-08');

            expect(report.lines).toHaveLength(2);
            const categoryIds = report.lines
                .map((line) => line.categoryId)
                .sort();
            expect(categoryIds).toEqual([1, 2]);
        });
    });

    // spec: service/goods-turnover — "Категория без движения товара —
    // позиция с нулевыми показателями"
    it('оставляет позицию с нулевыми показателями для категории без движения товара', async () => {
        await withRequestContext(async () => {
            const { service } = buildService({
                categories: [buildCategory(1)],
                warehouses: [buildWarehouse(10)],
                fetchGoodsFlowReport: jest.fn().mockResolvedValue(zeroResponse),
            });

            const report = await service.build('2026-08');

            expect(report.lines).toHaveLength(1);
            expect(report.lines[0].outcome.quantity).toBe(0);
            expect(report.lines[0].outcome.sum).toBe(0);
            expect(report.lines[0].stock.quantity).toBe(0);
            expect(report.lines[0].stock.sum).toBe(0);
        });
    });

    // spec: service/goods-turnover — "Отчёт строится отдельно по каждому
    // складу": одна категория на разных складах — раздельные позиции.
    it('строит раздельные позиции для одной категории на разных складах', async () => {
        await withRequestContext(async () => {
            const fetchGoodsFlowReport = jest.fn(
                async (
                    params: Parameters<RoappGateway['fetchGoodsFlowReport']>[0],
                ) => {
                    await Promise.resolve();
                    const [warehouseId] = params.warehouses;
                    return warehouseId === 10
                        ? {
                              outcome: { quantity: 1, sum: 1_000 },
                              stock: { quantity: 2, sum: 2_000 },
                          }
                        : {
                              outcome: { quantity: 3, sum: 3_000 },
                              stock: { quantity: 4, sum: 4_000 },
                          };
                },
            );
            const { service } = buildService({
                categories: [buildCategory(1)],
                warehouses: [buildWarehouse(10), buildWarehouse(20)],
                fetchGoodsFlowReport,
            });

            const report = await service.build('2026-08');

            expect(report.lines).toHaveLength(2);
            const byWarehouse = new Map(
                report.lines.map((line) => [line.warehouseId, line]),
            );
            expect(byWarehouse.get(10)?.outcome.sum).toBe(1_000);
            expect(byWarehouse.get(20)?.outcome.sum).toBe(3_000);
        });
    });

    // spec: service/goods-turnover — "Позиция отчёта содержит все четыре
    // показателя"
    it('позиция отчёта содержит количество и сумму расхода и остатка', async () => {
        await withRequestContext(async () => {
            const { service } = buildService({
                categories: [buildCategory(1)],
                warehouses: [buildWarehouse(10)],
                fetchGoodsFlowReport: jest.fn().mockResolvedValue({
                    outcome: { quantity: 5, sum: 50_000 },
                    stock: { quantity: 7, sum: 70_000 },
                }),
            });

            const report = await service.build('2026-08');

            expect(report.lines[0].outcome.quantity).toBe(5);
            expect(report.lines[0].outcome.sum).toBe(50_000);
            expect(report.lines[0].stock.quantity).toBe(7);
            expect(report.lines[0].stock.sum).toBe(70_000);
        });
    });

    // spec: service/goods-turnover — "Коэффициент считается по формуле
    // среднего остатка в рублях", читает остаток прошлого периода из
    // GOODS_TURNOVER_REPORT_LINE_REPOSITORY.findByPeriod, без доп. вызовов ERP.
    it('рассчитывает коэффициент оборачиваемости по сохранённому остатку прошлого месяца', async () => {
        await withRequestContext(async () => {
            const previousLine = GoodsTurnoverReportLine.create({
                period: '2026-07',
                categoryId: 1,
                warehouseId: 10,
                outcome: GoodsFlowMetric.zero(),
                stock: GoodsFlowMetric.create(1, 20_000),
            });
            const { service, findByPeriod } = buildService({
                categories: [buildCategory(1)],
                warehouses: [buildWarehouse(10)],
                previousLines: [previousLine],
                fetchGoodsFlowReport: jest.fn().mockResolvedValue({
                    outcome: { quantity: 2, sum: 40_000 },
                    stock: { quantity: 3, sum: 60_000 },
                }),
            });

            const report = await service.build('2026-08');

            // average = (20_000 + 60_000) / 2 = 40_000; ratio = 40_000 / 40_000 = 1
            expect(report.lines[0].turnoverRatio).toBe(1);
            expect(findByPeriod).toHaveBeenCalledWith('2026-07');
        });
    });

    // spec: service/goods-turnover — "Нет сохранённых данных за прошлый
    // месяц — коэффициент не рассчитывается"
    it('не рассчитывает коэффициент, когда нет сохранённых данных прошлого месяца по этой паре', async () => {
        await withRequestContext(async () => {
            const { service } = buildService({
                categories: [buildCategory(1)],
                warehouses: [buildWarehouse(10)],
                previousLines: [],
                fetchGoodsFlowReport: jest.fn().mockResolvedValue({
                    outcome: { quantity: 2, sum: 40_000 },
                    stock: { quantity: 3, sum: 60_000 },
                }),
            });

            const report = await service.build('2026-08');

            expect(report.lines[0].turnoverRatio).toBeNull();
        });
    });

    // design.md D6: сбой отдельной пары категория-склад не должен прерывать
    // построение отчёта целиком — частичный успех.
    it('пропускает пару категория-склад при сбое вызова ERP и не прерывает построение остальных', async () => {
        await withRequestContext(async () => {
            const fetchGoodsFlowReport = jest.fn(
                async (
                    params: Parameters<RoappGateway['fetchGoodsFlowReport']>[0],
                ) => {
                    await Promise.resolve();
                    if (params.category_id === 2) {
                        throw new Error('502 Bad Gateway');
                    }
                    return zeroResponse;
                },
            );
            const { service } = buildService({
                categories: [buildCategory(1), buildCategory(2)],
                warehouses: [buildWarehouse(10)],
                fetchGoodsFlowReport,
            });

            const report = await service.build('2026-08');

            expect(report.lines).toHaveLength(1);
            expect(report.lines[0].categoryId).toBe(1);
        });
    });

    it('пустые справочники категорий/складов дают отчёт без позиций, без ошибки', async () => {
        await withRequestContext(async () => {
            const { service } = buildService({
                categories: [],
                warehouses: [],
                fetchGoodsFlowReport: jest.fn(),
            });

            const report = await service.build('2026-08');

            expect(report.lines).toHaveLength(0);
        });
    });

    // design.md, риск "Комбинаторика категория × склад" + задача 9.3 /
    // warehouse-api-finding.md — не более GOODS_FLOW_REPORT_CONCURRENCY
    // одновременно летящих вызовов getGoodsFlowReport.
    it('ограничивает число одновременных вызовов getGoodsFlowReport лимитом параллелизма', async () => {
        await withRequestContext(async () => {
            let active = 0;
            let maxActive = 0;
            const fetchGoodsFlowReport = jest.fn(async () => {
                active++;
                maxActive = Math.max(maxActive, active);
                await new Promise((resolve) => setTimeout(resolve, 5));
                active--;
                return zeroResponse;
            });
            const categories = Array.from({ length: 6 }, (_, i) =>
                buildCategory(i + 1),
            );
            const { service } = buildService({
                categories,
                warehouses: [buildWarehouse(10)],
                fetchGoodsFlowReport,
            });

            const report = await service.build('2026-08');

            expect(report.lines).toHaveLength(6);
            expect(maxActive).toBeLessThanOrEqual(
                GOODS_FLOW_REPORT_CONCURRENCY,
            );
            // 6 пар > лимита — реально работает параллельно, а не
            // последовательно один-за-одним.
            expect(maxActive).toBe(GOODS_FLOW_REPORT_CONCURRENCY);
        });
    });

    it('запрашивает getGoodsFlowReport с диапазоном дат месяца, category_id и одним складом', async () => {
        await withRequestContext(async () => {
            const fetchGoodsFlowReport = jest
                .fn()
                .mockResolvedValue(zeroResponse);
            const { service } = buildService({
                categories: [buildCategory(7)],
                warehouses: [buildWarehouse(3)],
                fetchGoodsFlowReport,
            });

            await service.build('2026-08');

            expect(fetchGoodsFlowReport).toHaveBeenCalledWith({
                startDate: Date.UTC(2026, 7, 1),
                endDate: Date.UTC(2026, 7, 31, 23, 59, 59, 999),
                category_id: 7,
                warehouses: [3],
            });
        });
    });
});
