import { GetGoodsTurnoverReportService } from './get-goods-turnover-report.service';
import type { GoodsTurnoverReportRepositoryPort } from '@/domains/shop/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report.port';
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
}) {
    const { currentLines = [], previousLines = [] } = options;

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

    const service = new GetGoodsTurnoverReportService(repository);

    return { service, findByPeriod };
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

        expect(result).toHaveLength(1);
        // (10000 + 20000) / 2 = 15000; 30000 / 15000 = 2
        expect(result[0].coefficient).toBe(2);
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

        expect(result).toHaveLength(1);
        expect(result[0].coefficient).toBeNull();
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

        expect(result).toHaveLength(1);
        expect(result[0].warehouseId).toBe('warehouse-2');
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

        expect(result).toHaveLength(2);
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

        expect(result[0]).toEqual({
            categoryId: 'category-1',
            warehouseId: 'warehouse-1',
            turnoverQuantity: 3,
            turnoverSum: 30_000,
            stockQuantity: 7,
            stockSum: 70_000,
            coefficient: null,
        });
    });
});
