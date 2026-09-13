import { ValueObject } from '@/shared/domain/value-object.base';

export interface GoodsTurnoverWarehouseTotalProps {
    warehouseId: string;
    turnoverSum: number;
    stockSum: number;
    stockQuantity: number;
    // null — ни одна из переданных строк не имеет посчитанного coefficient (та же семантика, что
    // у TurnoverCoefficient.isAvailable() === false — "не рассчитан", не "0").
    coefficient: number | null;
}

// Строка, достаточная для расчёта итога — не импортируется из application (GoodsTurnoverReportLineDto),
// domain не должен зависеть от application (backend/CLAUDE.md, "Layering") — структурно совпадает с
// полями GoodsTurnoverReportLineDto, используемыми здесь.
export interface GoodsTurnoverWarehouseTotalSourceLine {
    turnoverSum: number;
    stockSum: number;
    stockQuantity: number;
    coefficient: number | null;
}

// implements FR5 of add-department-head-salary-rules
// Итоговая строка «по складу» отчёта «Оборачиваемость» магазина (design.md Decision 6a) — третья
// (после warehouse/service и accounting/service+shop) независимая реализация формулы «сумма по
// настоящим корневым строкам + средневзвешенный по остатку (₽) коэффициент», перенесённой без
// изменений с frontend (`summarizeShopGoodsTurnoverRows`,
// pages/GoodsTurnoverReport/model/shop/goodsTurnoverTree.ts). Нет объединяющего агрегата за период
// (Context, backend/CLAUDE.md: каждая строка отчёта — самостоятельный агрегат) — `calculate()`
// вызывается статически из `GetGoodsTurnoverReportService`, по образцу уже существующего
// `TurnoverCoefficient.calculate`.
//
// `calculate()` НЕ фильтрует строки по признаку «корневая категория» сам — критерий корня для
// строки shop-отчёта не виден вовсе (ни на самой строке, ни в её DTO — только в справочнике
// MoySkladProductFolder.parentId), поэтому фильтрацию и группировку по складу делает вызывающая
// сторона.
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
