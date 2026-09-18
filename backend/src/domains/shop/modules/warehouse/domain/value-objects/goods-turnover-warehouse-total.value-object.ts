import { ValueObject } from '@/shared/domain/value-object.base';
import { Money } from '@/domains/shop/modules/warehouse/domain/value-objects/money.value-object';
import { TurnoverCoefficient } from '@/domains/shop/modules/warehouse/domain/value-objects/turnover-coefficient.value-object';

export interface GoodsTurnoverWarehouseTotalProps {
    warehouseId: string;
    turnoverSum: number;
    stockSum: number;
    stockQuantity: number;
    // null — та же семантика, что у TurnoverCoefficient.isAvailable() === false: нет строки за
    // предыдущий период для этого склада (первый месяц данных), либо оба суммарных остатка нулевые.
    coefficient: number | null;
}

// Строка, достаточная для расчёта итога — не импортируется из application (GoodsTurnoverReportLineDto),
// domain не должен зависеть от application (backend/CLAUDE.md, "Layering") — структурно совпадает с
// полями GoodsTurnoverReportLineDto, используемыми здесь.
export interface GoodsTurnoverWarehouseTotalSourceLine {
    turnoverSum: number;
    stockSum: number;
    stockQuantity: number;
}

// implements FR5 of add-department-head-salary-rules
// Итоговая строка «по складу» отчёта «Оборачиваемость» магазина (design.md Decision 6a). Правка
// пользователя от 2026-09-18: изначальная формула («средневзвешенный по остатку (₽) коэффициент
// строк», перенесённая без изменений с frontend `summarizeShopGoodsTurnoverRows`) давала итог,
// не сходящийся с ручным расчётом «оборот по складу ÷ средний остаток по складу» — категория с
// самым высоким локальным коэффициентом («БУ») к концу месяца резко просела в остатке, поэтому
// средневзвешенный итог занижался относительно интуитивно ожидаемого отношения сумм. Заменено на
// тот же TurnoverCoefficient.calculate, что уже применяется на уровне строки (design.md D8), но
// от просуммированных по складу оборота/остатка — т.е. коэффициент по складу считается ровно так
// же, как коэффициент по одной категории, только "категория" здесь — весь склад целиком. Нет
// объединяющего агрегата за период (Context, backend/CLAUDE.md: каждая строка отчёта —
// самостоятельный агрегат) — `calculate()` вызывается статически из `GetGoodsTurnoverReportService`.
//
// `calculate()` НЕ фильтрует строки по признаку «корневая категория» сам — критерий корня для
// строки shop-отчёта не виден вовсе (ни на самой строке, ни в её DTO — только в справочнике
// MoySkladProductFolder.parentId), поэтому фильтрацию и группировку по складу делает вызывающая
// сторона; `previousStockSum` — сумма stockSum тех же корневых строк склада за предыдущий период,
// её тоже считает вызывающая сторона (там уже есть строки предыдущего периода для TurnoverCoefficient
// на уровне строки).
export class GoodsTurnoverWarehouseTotal extends ValueObject<GoodsTurnoverWarehouseTotalProps> {
    static calculate(
        warehouseId: string,
        rootLines: GoodsTurnoverWarehouseTotalSourceLine[],
        previousStockSum: number | null,
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

        const ratio = TurnoverCoefficient.calculate(
            Money.ofKopecks(turnoverSum),
            previousStockSum === null
                ? null
                : Money.ofKopecks(previousStockSum),
            Money.ofKopecks(stockSum),
        );

        return new GoodsTurnoverWarehouseTotal({
            warehouseId,
            turnoverSum,
            stockSum,
            stockQuantity,
            coefficient: ratio.isAvailable() ? ratio.getValue() : null,
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
