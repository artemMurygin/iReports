// implements FR4 of add-department-head-salary-rules
// Дублирует формулу TurnoverCoefficient.calculate (domains/shop/modules/warehouse, design.md D8) —
// не вызывает её напрямую (root CLAUDE.md, «Межмодульные зависимости внутри backend»: accounting не
// импортирует warehouse). moy_sklad_turnover_report_lines не хранит коэффициент (в отличие от
// service) — ShopTurnoverReportRepository считает его сам при чтении, сравнивая остаток текущего и
// предыдущего периода одной и той же категории/склада.
//
// null — нет строки за предыдущий период (первый месяц данных или новая категория) либо средний
// остаток равен нулю (деление на ноль не выполняется) — та же семантика "не рассчитан", не "0", что
// и у TurnoverCoefficient.isAvailable() === false в warehouse/shop.
export function resolveTurnoverCoefficient(
    turnoverSum: number,
    previousStockSum: number | null,
    currentStockSum: number,
): number | null {
    if (previousStockSum === null) {
        return null;
    }

    const averageStock = (previousStockSum + currentStockSum) / 2;
    if (averageStock === 0) {
        return null;
    }

    return turnoverSum / averageStock;
}
