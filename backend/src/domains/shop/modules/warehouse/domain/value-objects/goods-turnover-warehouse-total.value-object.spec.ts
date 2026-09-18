import { GoodsTurnoverWarehouseTotal } from './goods-turnover-warehouse-total.value-object';

// Правка пользователя от 2026-09-18 (см. WHY в goods-turnover-warehouse-total.value-object.ts):
// coefficient итога по складу — TurnoverCoefficient.calculate от просуммированных по складу
// оборота/остатка (тот же расчёт, что и по одной строке-категории, design.md D8), а не
// средневзвешенный по строкам-категориям — это заменило исходную формулу задачи 5.1.
// `calculate()` сам не фильтрует строки по признаку «корневая категория» — это делает вызывающая
// сторона (GetGoodsTurnoverReportService), т.к. критерий корня не виден на самой строке отчёта (см.
// комментарий вверху goods-turnover-warehouse-total.value-object.ts).
describe('GoodsTurnoverWarehouseTotal.calculate', () => {
    it('суммирует turnoverSum/stockSum/stockQuantity по переданным строкам', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate(
            'warehouse-1',
            [
                { turnoverSum: 100, stockSum: 200, stockQuantity: 4 },
                { turnoverSum: 60, stockSum: 120, stockQuantity: 2 },
            ],
            300,
        );

        expect(total.warehouseId).toBe('warehouse-1');
        expect(total.turnoverSum).toBe(160);
        expect(total.stockSum).toBe(320);
        expect(total.stockQuantity).toBe(6);
    });

    it('coefficient = turnoverSum ÷ средний(previousStockSum, stockSum) по сумме склада', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate(
            'warehouse-1',
            [
                { turnoverSum: 100, stockSum: 100, stockQuantity: 1 },
                { turnoverSum: 600, stockSum: 300, stockQuantity: 3 },
            ],
            300,
        );

        // turnoverSum = 700, stockSum = 400, previousStockSum = 300 -> 700 / ((300+400)/2) = 2.
        expect(total.coefficient).toBeCloseTo(2);
    });

    it('coefficient null, если нет строки за предыдущий период (previousStockSum === null)', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate(
            'warehouse-1',
            [{ turnoverSum: 100, stockSum: 100, stockQuantity: 1 }],
            null,
        );

        expect(total.coefficient).toBeNull();
    });

    it('coefficient null и нулевые суммы для пустого списка строк', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate(
            'warehouse-1',
            [],
            null,
        );

        expect(total.coefficient).toBeNull();
        expect(total.turnoverSum).toBe(0);
        expect(total.stockSum).toBe(0);
        expect(total.stockQuantity).toBe(0);
    });

    it('coefficient null, если оба суммарных остатка (текущий и предыдущий) нулевые', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate(
            'warehouse-1',
            [{ turnoverSum: 0, stockSum: 0, stockQuantity: 0 }],
            0,
        );

        expect(total.coefficient).toBeNull();
    });
});
