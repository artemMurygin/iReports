import { withRequestContext } from '@/shared/testing/with-request-context';
import { GoodsFlowMetric } from '../../value-objects/goods-flow-metric.value-object';
import {
    DuplicateGoodsTurnoverReportLineException,
    GoodsTurnoverReportLinePeriodMismatchException,
} from '../../exceptions/goods-turnover-report.exception';
import { GoodsTurnoverReportLine } from './goods-turnover-report-line.entity';
import { GoodsTurnoverReport } from './goods-turnover-report.entity';

function buildLine(
    categoryId: number,
    warehouseId: number,
    period = '2026-08',
): GoodsTurnoverReportLine {
    return GoodsTurnoverReportLine.create({
        period,
        categoryId,
        warehouseId,
        outcome: GoodsFlowMetric.zero(),
        stock: GoodsFlowMetric.zero(),
    });
}

function buildLineWithFlow(
    categoryId: number,
    warehouseId: number,
    props: { outcomeSum?: number; stockSum?: number; stockQuantity?: number },
    period = '2026-08',
): GoodsTurnoverReportLine {
    return GoodsTurnoverReportLine.create({
        period,
        categoryId,
        warehouseId,
        outcome: GoodsFlowMetric.create(0, props.outcomeSum ?? 0),
        stock: GoodsFlowMetric.create(
            props.stockQuantity ?? 0,
            props.stockSum ?? 0,
        ),
    });
}

describe('GoodsTurnoverReport', () => {
    it('строит агрегат из позиций разных пар категория-склад', () => {
        const report = GoodsTurnoverReport.create({
            period: '2026-08',
            lines: [buildLine(1, 1), buildLine(2, 1), buildLine(1, 2)],
        });

        expect(report.period).toBe('2026-08');
        expect(report.lines).toHaveLength(3);
    });

    it('допускает одну и ту же категорию на разных складах', () => {
        const report = GoodsTurnoverReport.create({
            period: '2026-08',
            lines: [buildLine(1, 1), buildLine(1, 2)],
        });

        expect(report.lines).toHaveLength(2);
    });

    it('допускает пустой отчёт (без позиций)', () => {
        const report = GoodsTurnoverReport.create({
            period: '2026-08',
            lines: [],
        });

        expect(report.lines).toHaveLength(0);
    });

    // Инвариант агрегата: уникальность (categoryId, warehouseId) в пределах периода.
    it('отклоняет дублирующуюся пару (categoryId, warehouseId) в пределах периода', () => {
        withRequestContext(() => {
            expect(() =>
                GoodsTurnoverReport.create({
                    period: '2026-08',
                    lines: [buildLine(1, 1), buildLine(1, 1)],
                }),
            ).toThrow(DuplicateGoodsTurnoverReportLineException);
        });
    });

    it('отклоняет строку, чей период не совпадает с периодом отчёта', () => {
        withRequestContext(() => {
            expect(() =>
                GoodsTurnoverReport.create({
                    period: '2026-08',
                    lines: [buildLine(1, 1, '2026-07')],
                }),
            ).toThrow(GoodsTurnoverReportLinePeriodMismatchException);
        });
    });

    // add-department-head-salary-rules, tasks.md задача 4.1 (design.md Decision 6a, FR5):
    // GoodsTurnoverReport.totals() — по одной записи GoodsTurnoverWarehouseTotal на каждый склад,
    // встретившийся в lines, посчитанной по строкам настоящих корневых категорий (rootCategoryIds).
    describe('totals', () => {
        it('пустой отчёт → пустой массив totals', () => {
            const report = GoodsTurnoverReport.create({
                period: '2026-08',
                lines: [],
            });

            expect(report.totals(new Set())).toEqual([]);
        });

        it('одна запись на склад — суммирует только строки настоящих корневых категорий', () => {
            const report = GoodsTurnoverReport.create({
                period: '2026-08',
                lines: [
                    buildLineWithFlow(1, 1, {
                        outcomeSum: 100,
                        stockSum: 200,
                        stockQuantity: 4,
                    }),
                    // дочерняя категория той же корневой — не должна задваивать сумму родителя
                    buildLineWithFlow(2, 1, {
                        outcomeSum: 60,
                        stockSum: 120,
                        stockQuantity: 2,
                    }),
                ],
            });

            const totals = report.totals(new Set([1]));

            expect(totals).toHaveLength(1);
            expect(totals[0].warehouseId).toBe(1);
            expect(totals[0].outcomeSum).toBe(100);
            expect(totals[0].stockSum).toBe(200);
            expect(totals[0].stockQuantity).toBe(4);
        });

        it('по одной записи на каждый склад, встретившийся в lines, включая склад без корневых строк', () => {
            const report = GoodsTurnoverReport.create({
                period: '2026-08',
                lines: [
                    buildLineWithFlow(1, 1, { outcomeSum: 100, stockSum: 200 }),
                    // категория 2 на складе 2 — не корневая (не входит в rootCategoryIds), но
                    // склад 2 всё равно должен появиться в totals с нулевыми суммами.
                    buildLineWithFlow(2, 2, { outcomeSum: 999, stockSum: 999 }),
                ],
            });

            const totals = report.totals(new Set([1]));

            expect(totals.map((t) => t.warehouseId).sort()).toEqual([1, 2]);
            const warehouse2 = totals.find((t) => t.warehouseId === 2);
            expect(warehouse2?.outcomeSum).toBe(0);
            expect(warehouse2?.stockSum).toBe(0);
            expect(warehouse2?.turnoverRatio).toBeNull();
        });
    });
});
