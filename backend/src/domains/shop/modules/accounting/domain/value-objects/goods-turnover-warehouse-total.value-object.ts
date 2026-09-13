import { ValueObject } from '@/shared/domain/value-object.base';

export interface GoodsTurnoverWarehouseTotalProps {
    warehouseId: string;
    turnoverSum: number;
    stockSum: number;
    stockQuantity: number;
    // null — ни одна из переданных строк не имеет посчитанного coefficient (та же семантика, что у
    // domains/shop/modules/warehouse — "не рассчитан", не "0").
    coefficient: number | null;
}

// Узкий локальный интерфейс со своими полями — не импортируется из domains/shop/modules/warehouse
// (root CLAUDE.md, «Межмодульные зависимости внутри backend»: accounting не читает entity/VO чужого
// модуля, даже структурно идентичную).
export interface GoodsTurnoverWarehouseTotalSourceLine {
    turnoverSum: number;
    stockSum: number;
    stockQuantity: number;
    coefficient: number | null;
}

// implements FR4 of add-department-head-salary-rules
// Третья (после warehouse/service и accounting/service) независимая реализация формулы «сумма по
// настоящим корневым строкам + средневзвешенный по остатку коэффициент» (design.md Decision 6b) —
// используется зарплатным правилом DepartmentTurnoverBonus (shop) через
// TurnoverReportSnapshot.total(). Дублирование, а не переиспользование VO модуля warehouse — root
// CLAUDE.md запрещает accounting импортировать что-либо из warehouse, даже read-only.
export class GoodsTurnoverWarehouseTotal extends ValueObject<GoodsTurnoverWarehouseTotalProps> {
    static calculate(
        warehouseId: string,
        rootLines: GoodsTurnoverWarehouseTotalSourceLine[],
    ): GoodsTurnoverWarehouseTotal {
        const turnoverSum = rootLines.reduce(
            (sum, line) => sum + line.turnoverSum,
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

        const linesWithCoefficient = rootLines.filter(
            (
                line,
            ): line is GoodsTurnoverWarehouseTotalSourceLine & {
                coefficient: number;
            } => line.coefficient !== null,
        );
        const coefficientWeight = linesWithCoefficient.reduce(
            (sum, line) => sum + line.stockSum,
            0,
        );
        const coefficient =
            linesWithCoefficient.length === 0 || coefficientWeight === 0
                ? null
                : linesWithCoefficient.reduce(
                      (sum, line) => sum + line.coefficient * line.stockSum,
                      0,
                  ) / coefficientWeight;

        return new GoodsTurnoverWarehouseTotal({
            warehouseId,
            turnoverSum,
            stockSum,
            stockQuantity,
            coefficient,
        });
    }

    get warehouseId(): string {
        return this.props.warehouseId;
    }

    get turnoverSum(): number {
        return this.props.turnoverSum;
    }

    get stockSum(): number {
        return this.props.stockSum;
    }

    get stockQuantity(): number {
        return this.props.stockQuantity;
    }

    get coefficient(): number | null {
        return this.props.coefficient;
    }
}
