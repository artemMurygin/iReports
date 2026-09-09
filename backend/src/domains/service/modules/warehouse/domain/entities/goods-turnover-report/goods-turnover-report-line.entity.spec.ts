import { withRequestContext } from '@/shared/testing/with-request-context';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { GoodsFlowMetric } from '../../value-objects/goods-flow-metric.value-object';
import { GoodsTurnoverReportLine } from './goods-turnover-report-line.entity';

function buildLine(
    overrides: Partial<{
        outcome: GoodsFlowMetric;
        stock: GoodsFlowMetric;
    }> = {},
): GoodsTurnoverReportLine {
    return GoodsTurnoverReportLine.create({
        period: '2026-08',
        categoryId: 10,
        warehouseId: 1,
        outcome: overrides.outcome ?? GoodsFlowMetric.create(2, 40_000),
        stock: overrides.stock ?? GoodsFlowMetric.create(5, 60_000),
    });
}

describe('GoodsTurnoverReportLine', () => {
    describe('create', () => {
        it('строит позицию с нулевым коэффициентом до расчёта', () => {
            const line = buildLine();

            expect(line.period).toBe('2026-08');
            expect(line.categoryId).toBe(10);
            expect(line.warehouseId).toBe(1);
            expect(line.outcome.sum).toBe(40_000);
            expect(line.stock.sum).toBe(60_000);
            expect(line.turnoverRatio).toBeNull();
        });
    });

    // spec.md: "Коэффициент считается по формуле среднего остатка в рублях"
    // outcome_₽(текущий) / ((остаток_₽(прошлый) + остаток_₽(текущий)) / 2)
    describe('calcRatio', () => {
        it('считает коэффициент по формуле среднего остатка в рублях, когда есть данные прошлого месяца', () => {
            const line = buildLine({
                outcome: GoodsFlowMetric.create(2, 40_000),
                stock: GoodsFlowMetric.create(5, 60_000),
            });

            // outcome.sum = 40_000, stockPreviousSum = 20_000, stock.sum = 60_000
            // average = (20_000 + 60_000) / 2 = 40_000
            // ratio = 40_000 / 40_000 = 1
            const ratio = line.calcRatio(20_000);

            expect(ratio).toBe(1);
            expect(line.turnoverRatio).toBe(1);
        });

        it('произвольные суммы дают дробный коэффициент', () => {
            const line = buildLine({
                outcome: GoodsFlowMetric.create(3, 30_000),
                stock: GoodsFlowMetric.create(4, 50_000),
            });

            // average = (10_000 + 50_000) / 2 = 30_000; ratio = 30_000 / 30_000 = 1
            // используем другие числа, чтобы получить не-целый результат
            const ratio = line.calcRatio(70_000);
            // average = (70_000 + 50_000) / 2 = 60_000; ratio = 30_000 / 60_000 = 0.5

            expect(ratio).toBe(0.5);
        });

        // spec.md: "Нет сохранённых данных за прошлый месяц — коэффициент не
        // рассчитывается" — null не подменяется нулевым остатком.
        it('не рассчитывает коэффициент, когда нет сохранённых данных за прошлый месяц', () => {
            const line = buildLine();

            const ratio = line.calcRatio(null);

            expect(ratio).toBeNull();
            expect(line.turnoverRatio).toBeNull();
        });

        // spec.md: "Средний остаток равен нулю — коэффициент не рассчитывается"
        // — деление на ноль не выполняется.
        it('не рассчитывает коэффициент, когда средний остаток равен нулю', () => {
            const line = buildLine({
                outcome: GoodsFlowMetric.create(1, 10_000),
                stock: GoodsFlowMetric.zero(),
            });

            const ratio = line.calcRatio(0);

            expect(ratio).toBeNull();
            expect(line.turnoverRatio).toBeNull();
        });

        it('пересчёт заменяет ранее сохранённое значение коэффициента', () => {
            const line = buildLine();
            line.calcRatio(20_000);
            expect(line.turnoverRatio).not.toBeNull();

            const ratio = line.calcRatio(null);

            expect(ratio).toBeNull();
            expect(line.turnoverRatio).toBeNull();
        });
    });

    describe('validate', () => {
        it('отклоняет неположительный categoryId', () => {
            withRequestContext(() => {
                expect(() =>
                    GoodsTurnoverReportLine.create({
                        period: '2026-08',
                        categoryId: 0,
                        warehouseId: 1,
                        outcome: GoodsFlowMetric.zero(),
                        stock: GoodsFlowMetric.zero(),
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });

        it('отклоняет неположительный warehouseId', () => {
            withRequestContext(() => {
                expect(() =>
                    GoodsTurnoverReportLine.create({
                        period: '2026-08',
                        categoryId: 1,
                        warehouseId: 0,
                        outcome: GoodsFlowMetric.zero(),
                        stock: GoodsFlowMetric.zero(),
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });

        it('отклоняет некорректный формат периода', () => {
            withRequestContext(() => {
                expect(() =>
                    GoodsTurnoverReportLine.create({
                        period: '2026/08',
                        categoryId: 1,
                        warehouseId: 1,
                        outcome: GoodsFlowMetric.zero(),
                        stock: GoodsFlowMetric.zero(),
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });
    });
});
