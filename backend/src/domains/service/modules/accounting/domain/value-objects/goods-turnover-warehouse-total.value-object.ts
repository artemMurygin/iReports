import { ValueObject } from '@/shared/domain/value-object.base';

export interface GoodsTurnoverWarehouseTotalProps {
    warehouseId: number;
    outcomeSum: number;
    stockSum: number;
    stockQuantity: number;
    // null — ни одна из переданных строк не имеет посчитанного turnoverRatio (та же семантика, что
    // и у domains/service/modules/warehouse — "не рассчитан", не "0").
    turnoverRatio: number | null;
}

// Узкий локальный интерфейс со своими полями — не импортируется из
// domains/service/modules/warehouse (root CLAUDE.md, «Межмодульные зависимости внутри backend»:
// accounting не читает entity/VO чужого модуля, даже структурно идентичную).
export interface GoodsTurnoverWarehouseTotalSourceLine {
    outcomeSum: number;
    stockSum: number;
    stockQuantity: number;
    turnoverRatio: number | null;
}

// implements FR4 of add-department-head-salary-rules
// Вторая (после domains/service/modules/warehouse) независимая реализация формулы «сумма по
// настоящим корневым строкам + средневзвешенный по остатку коэффициент» (design.md Decision 6b) —
// используется зарплатным правилом DepartmentTurnoverBonus через TurnoverReportSnapshot.total(), а
// не отчётом «Оборачиваемость». Дублирование, а не переиспользование VO модуля warehouse — root
// CLAUDE.md запрещает accounting импортировать что-либо из warehouse, даже read-only.
export class GoodsTurnoverWarehouseTotal extends ValueObject<GoodsTurnoverWarehouseTotalProps> {
    static calculate(
        warehouseId: number,
        rootLines: GoodsTurnoverWarehouseTotalSourceLine[],
    ): GoodsTurnoverWarehouseTotal {
        const outcomeSum = rootLines.reduce(
            (sum, line) => sum + line.outcomeSum,
            0,
        );
        const stockSum = rootLines.reduce(
            (sum, line) => sum + line.stockSum,
            0,
        );
        const stockQuantity = rootLines.reduce(
            (sum, line) => sum + line.stockQuantity,
            0,
        );

        const linesWithRatio = rootLines.filter(
            (
                line,
            ): line is GoodsTurnoverWarehouseTotalSourceLine & {
                turnoverRatio: number;
            } => line.turnoverRatio !== null,
        );
        const ratioWeight = linesWithRatio.reduce(
            (sum, line) => sum + line.stockSum,
            0,
        );
        const turnoverRatio =
            linesWithRatio.length === 0 || ratioWeight === 0
                ? null
                : linesWithRatio.reduce(
                      (sum, line) => sum + line.turnoverRatio * line.stockSum,
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
