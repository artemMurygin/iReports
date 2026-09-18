import { GetGoodsTurnoverReportService } from './get-goods-turnover-report.service';
import type { GoodsTurnoverReportRepositoryPort } from '@/domains/shop/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report.port';
import type { ProductCategoryRepositoryPort } from '@/domains/shop/modules/warehouse/application/ports/product-category/product-category.port';
import { GoodsTurnoverReportLine } from '@/domains/shop/modules/warehouse/domain/entities/goods-turnover-report-line/goods-turnover-report-line.entity';
import { Money } from '@/domains/shop/modules/warehouse/domain/value-objects/money.value-object';
import { Period } from '@/shared/domain/period.value-object';

function line(props: {
    period: Period;
    categoryId: string;
    warehouseId: string;
    turnoverQuantity?: number;
    turnoverSum?: number;
    stockQuantity?: number;
    stockSum?: number;
}): GoodsTurnoverReportLine {
    return GoodsTurnoverReportLine.create({
        period: props.period,
        categoryId: props.categoryId,
        warehouseId: props.warehouseId,
        turnoverQuantity: props.turnoverQuantity ?? 0,
        turnoverSum: Money.ofKopecks(props.turnoverSum ?? 0),
        stockQuantity: props.stockQuantity ?? 0,
        stockSum: Money.ofKopecks(props.stockSum ?? 0),
    });
}

function buildService(options: {
    currentLines?: GoodsTurnoverReportLine[];
    previousLines?: GoodsTurnoverReportLine[];
    rootCategoryIds?: string[];
}) {
    const {
        currentLines = [],
        previousLines = [],
        rootCategoryIds = [],
    } = options;

    const findByPeriod = jest.fn((period: Period) => {
        return Promise.resolve(
            period.getValue() === CURRENT.getValue()
                ? currentLines
                : previousLines,
        );
    });
    const repository: GoodsTurnoverReportRepositoryPort = {
        findByPeriod,
        replaceForPeriod: jest.fn().mockResolvedValue(undefined),
    };
    const findRootIds = jest
        .fn<Promise<Set<string>>, []>()
        .mockResolvedValue(new Set(rootCategoryIds));
    const categoryRepository: ProductCategoryRepositoryPort = {
        findRootIds,
    };

    const service = new GetGoodsTurnoverReportService(
        repository,
        categoryRepository,
    );

    return { service, findByPeriod, findRootIds };
}

const CURRENT = Period.create('2026-08');
const PREVIOUS = Period.create('2026-07');

describe('GetGoodsTurnoverReportService.getReport', () => {
    it('читает строки текущего и предыдущего периода через репозиторий', async () => {
        const { service, findByPeriod } = buildService({});

        await service.getReport(CURRENT);

        expect(findByPeriod).toHaveBeenCalledWith(CURRENT);
        expect(findByPeriod).toHaveBeenCalledWith(PREVIOUS);
    });

    it('считает коэффициент по паре categoryId/warehouseId, сопоставляя строку с предыдущим периодом', async () => {
        const { service } = buildService({
            currentLines: [
                line({
                    period: CURRENT,
                    categoryId: 'category-1',
                    warehouseId: 'warehouse-1',
                    turnoverSum: 30_000,
                    stockSum: 20_000,
                }),
            ],
            previousLines: [
                line({
                    period: PREVIOUS,
                    categoryId: 'category-1',
                    warehouseId: 'warehouse-1',
                    stockSum: 10_000,
                }),
            ],
        });

        const result = await service.getReport(CURRENT);

        expect(result.lines).toHaveLength(1);
        // (10000 + 20000) / 2 = 15000; 30000 / 15000 = 2
        expect(result.lines[0].coefficient).toBe(2);
    });

    it('строки без пары в предыдущем периоде -> coefficient: null, а не 0', async () => {
        const { service } = buildService({
            currentLines: [
                line({
                    period: CURRENT,
                    categoryId: 'category-new',
                    warehouseId: 'warehouse-1',
                    turnoverSum: 50_000,
                    stockSum: 10_000,
                }),
            ],
            previousLines: [],
        });

        const result = await service.getReport(CURRENT);

        expect(result.lines).toHaveLength(1);
        expect(result.lines[0].coefficient).toBeNull();
    });

    it('фильтрует результат по warehouseId, если он указан', async () => {
        const { service } = buildService({
            currentLines: [
                line({
                    period: CURRENT,
                    categoryId: 'category-1',
                    warehouseId: 'warehouse-1',
                }),
                line({
                    period: CURRENT,
                    categoryId: 'category-1',
                    warehouseId: 'warehouse-2',
                }),
            ],
        });

        const result = await service.getReport(CURRENT, 'warehouse-2');

        expect(result.lines).toHaveLength(1);
        expect(result.lines[0].warehouseId).toBe('warehouse-2');
    });

    it('без warehouseId возвращает строки всех складов', async () => {
        const { service } = buildService({
            currentLines: [
                line({
                    period: CURRENT,
                    categoryId: 'category-1',
                    warehouseId: 'warehouse-1',
                }),
                line({
                    period: CURRENT,
                    categoryId: 'category-1',
                    warehouseId: 'warehouse-2',
                }),
            ],
        });

        const result = await service.getReport(CURRENT);

        expect(result.lines).toHaveLength(2);
    });

    it('маппит плоскую структуру DTO из строки отчёта', async () => {
        const { service } = buildService({
            currentLines: [
                line({
                    period: CURRENT,
                    categoryId: 'category-1',
                    warehouseId: 'warehouse-1',
                    turnoverQuantity: 3,
                    turnoverSum: 30_000,
                    stockQuantity: 7,
                    stockSum: 70_000,
                }),
            ],
        });

        const result = await service.getReport(CURRENT);

        expect(result.lines[0]).toEqual({
            categoryId: 'category-1',
            warehouseId: 'warehouse-1',
            turnoverQuantity: 3,
            turnoverSum: 30_000,
            stockQuantity: 7,
            stockSum: 70_000,
            coefficient: null,
        });
    });

    // add-department-head-salary-rules, tasks.md задача 5.1 (FR5, BREAKING): ответ возвращает
    // {lines, totals} вместо голого массива — totals суммирует только строки настоящих корневых
    // категорий (rootCategoryIds из ProductCategoryRepositoryPort.findRootIds()), по одной записи
    // на каждый склад, встретившийся в lines.
    describe('totals', () => {
        it('суммирует только строки настоящих корневых категорий, не дочерние', async () => {
            const { service } = buildService({
                currentLines: [
                    line({
                        period: CURRENT,
                        categoryId: 'root-1',
                        warehouseId: 'warehouse-1',
                        turnoverSum: 100,
                        stockSum: 200,
                    }),
                    line({
                        period: CURRENT,
                        categoryId: 'child-1',
                        warehouseId: 'warehouse-1',
                        turnoverSum: 60,
                        stockSum: 120,
                    }),
                ],
                rootCategoryIds: ['root-1'],
            });

            const result = await service.getReport(CURRENT);

            expect(result.totals).toEqual([
                {
                    warehouseId: 'warehouse-1',
                    turnoverSum: 100,
                    stockSum: 200,
                    stockQuantity: 0,
                    coefficient: null,
                },
            ]);
        });

        it('по одной записи на каждый склад, встретившийся в lines, включая склад без корневых строк', async () => {
            const { service } = buildService({
                currentLines: [
                    line({
                        period: CURRENT,
                        categoryId: 'root-1',
                        warehouseId: 'warehouse-1',
                        turnoverSum: 100,
                        stockSum: 200,
                    }),
                    line({
                        period: CURRENT,
                        categoryId: 'child-of-root-1',
                        warehouseId: 'warehouse-2',
                        turnoverSum: 999,
                        stockSum: 999,
                    }),
                ],
                rootCategoryIds: ['root-1'],
            });

            const result = await service.getReport(CURRENT);

            expect(result.totals.map((t) => t.warehouseId).sort()).toEqual([
                'warehouse-1',
                'warehouse-2',
            ]);
            const warehouse2 = result.totals.find(
                (t) => t.warehouseId === 'warehouse-2',
            );
            expect(warehouse2).toMatchObject({
                turnoverSum: 0,
                stockSum: 0,
                coefficient: null,
            });
        });

        it('пустой период — totals пустой массив', async () => {
            const { service } = buildService({ currentLines: [] });

            const result = await service.getReport(CURRENT);

            expect(result.totals).toEqual([]);
        });

        // Правка пользователя от 2026-09-18: coefficient итога — TurnoverCoefficient от суммы
        // оборота/остатков ПО ВСЕМ корневым строкам склада, а не средневзвешенный по строкам;
        // previousStockSum считается по всем корневым строкам предыдущего периода склада (в т.ч.
        // тем, что не совпали по categoryId с текущим периодом), не только по matched-парам.
        it('coefficient итога = turnoverSum(root) ÷ средний(prevStockSum(root), stockSum(root))', async () => {
            const { service } = buildService({
                currentLines: [
                    line({
                        period: CURRENT,
                        categoryId: 'root-1',
                        warehouseId: 'warehouse-1',
                        turnoverSum: 100,
                        stockSum: 200,
                    }),
                    line({
                        period: CURRENT,
                        categoryId: 'root-2',
                        warehouseId: 'warehouse-1',
                        turnoverSum: 600,
                        stockSum: 200,
                    }),
                    // Дочерняя категория — не должна попадать ни в turnoverSum/stockSum итога, ни
                    // влиять на previousStockSum.
                    line({
                        period: CURRENT,
                        categoryId: 'child-1',
                        warehouseId: 'warehouse-1',
                        turnoverSum: 999,
                        stockSum: 999,
                    }),
                ],
                previousLines: [
                    line({
                        period: PREVIOUS,
                        categoryId: 'root-1',
                        warehouseId: 'warehouse-1',
                        stockSum: 100,
                    }),
                    line({
                        period: PREVIOUS,
                        categoryId: 'root-2',
                        warehouseId: 'warehouse-1',
                        stockSum: 500,
                    }),
                ],
                rootCategoryIds: ['root-1', 'root-2'],
            });

            const result = await service.getReport(CURRENT);

            // turnoverSum = 700, stockSum = 400, previousStockSum = 600 -> 700 / ((600+400)/2) = 1.4
            expect(result.totals).toEqual([
                expect.objectContaining({
                    warehouseId: 'warehouse-1',
                    turnoverSum: 700,
                    stockSum: 400,
                    coefficient: 1.4,
                }),
            ]);
        });
    });
});
