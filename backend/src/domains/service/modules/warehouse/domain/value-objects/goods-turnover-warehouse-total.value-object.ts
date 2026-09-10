import { ValueObject } from '@/shared/domain/value-object.base';
import { GoodsTurnoverReportLine } from '../entities/goods-turnover-report/goods-turnover-report-line.entity';

export interface GoodsTurnoverWarehouseTotalProps {
    warehouseId: number;
    outcomeSum: number;
    stockSum: number;
    stockQuantity: number;
    // null — ни одна из переданных строк не имеет посчитанного turnoverRatio (та же семантика, что
    // и у GoodsTurnoverReportLine.turnoverRatio — "не рассчитан", не "0").
    turnoverRatio: number | null;
}

// implements FR5 of add-department-head-salary-rules
// Итоговая строка «по складу» отчёта «Оборачиваемость» (design.md Decision 6a) — сумма outcome/
// stock и средневзвешенный по остатку (₽) коэффициент по
// набору строк одного склада. Формула перенесена без изменений с frontend
// (`summarizeGoodsTurnoverRows`, pages/GoodsTurnoverReport/model/goodsTurnoverTree.ts): сумма по
// «настоящим корневым» категориям + Σ ratio_i·stockSum_i / Σ stockSum_i по строкам с уже посчитанным
// коэффициентом.
//
// `calculate()` НЕ фильтрует строки по признаку «корневая категория» сам — критерий корня не виден
// на самой `GoodsTurnoverReportLine` (только в справочнике категорий, денормализуется отдельно на
// уровне ответа), поэтому фильтрацию и группировку по складу делает вызывающая сторона
// (`GoodsTurnoverReport.totals()`, задача 4) — сюда уже передаются только строки настоящих корневых
// категорий ОДНОГО склада.
export class GoodsTurnoverWarehouseTotal extends ValueObject<GoodsTurnoverWarehouseTotalProps> {
    static calculate(
        warehouseId: number,
        rootLines: GoodsTurnoverReportLine[],
    ): GoodsTurnoverWarehouseTotal {
        const outcomeSum = rootLines.reduce(
            (sum, line) => sum + line.outcome.sum,
            0,
        );
        const stockSum = rootLines.reduce(
            (sum, line) => sum + line.stock.sum,
            0,
        );
        const stockQuantity = rootLines.reduce(
            (sum, line) => sum + line.stock.quantity,
            0,
        );

        const linesWithRatio = rootLines.filter(
            (
                line,
            ): line is GoodsTurnoverReportLine & { turnoverRatio: number } =>
                line.turnoverRatio !== null,
        );
        const ratioWeight = linesWithRatio.reduce(
            (sum, line) => sum + line.stock.sum,
            0,
        );
        const turnoverRatio =
            linesWithRatio.length === 0 || ratioWeight === 0
                ? null
                : linesWithRatio.reduce(
                      (sum, line) => sum + line.turnoverRatio * line.stock.sum,
                      0,
                  ) / ratioWeight;

        return new GoodsTurnoverWarehouseTotal({
            warehouseId,
            outcomeSum,
            stockSum,
            stockQuantity,
            turnoverRatio,
        });
    }

    get warehouseId(): number {
        return this.props.warehouseId;
    }

    get outcomeSum(): number {
        return this.props.outcomeSum;
    }

    get stockSum(): number {
        return this.props.stockSum;
    }

    get stockQuantity(): number {
        return this.props.stockQuantity;
    }

    get turnoverRatio(): number | null {
        return this.props.turnoverRatio;
    }
}
