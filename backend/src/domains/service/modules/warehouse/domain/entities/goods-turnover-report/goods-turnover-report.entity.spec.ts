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
});
