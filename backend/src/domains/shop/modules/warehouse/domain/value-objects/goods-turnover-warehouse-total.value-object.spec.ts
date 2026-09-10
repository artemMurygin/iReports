import { GoodsTurnoverWarehouseTotal } from './goods-turnover-warehouse-total.value-object';

// add-department-head-salary-rules, tasks.md задача 5.1 (design.md Decision 6a): независимая
// (от warehouse/service) реализация той же формулы «сумма по настоящим корневым строкам +
// средневзвешенный по остатку (₽) коэффициент», вызывается статически по образцу уже
// существующего TurnoverCoefficient.calculate. `calculate()` сам не фильтрует строки по признаку
// «корневая категория» — это делает вызывающая сторона (GetGoodsTurnoverReportService, задача 5.3),
// т.к. критерий корня не виден на самой строке отчёта (см. комментарий вверху
// goods-turnover-warehouse-total.value-object.ts).
describe('GoodsTurnoverWarehouseTotal.calculate', () => {
    it('суммирует turnoverSum/stockSum/stockQuantity по переданным строкам', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate('warehouse-1', [
            {
                turnoverSum: 100,
                stockSum: 200,
                stockQuantity: 4,
                coefficient: null,
            },
            {
                turnoverSum: 60,
                stockSum: 120,
                stockQuantity: 2,
                coefficient: null,
            },
        ]);

        expect(total.warehouseId).toBe('warehouse-1');
        expect(total.turnoverSum).toBe(160);
        expect(total.stockSum).toBe(320);
        expect(total.stockQuantity).toBe(6);
    });

    // Воспроизводит фикстуру фронтенда summarizeShopGoodsTurnoverRows
    // (frontend/.../model/shop/goodsTurnoverTree.ts): coefficient 1 при stockSum 100, coefficient 2
    // при stockSum 300 -> (1*100 + 2*300) / 400 = 1.75.
    it('считает средневзвешенный по stockSum коэффициент по строкам с посчитанным coefficient', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate('warehouse-1', [
            {
                turnoverSum: 100,
                stockSum: 100,
                stockQuantity: 1,
                coefficient: 1,
            },
            {
                turnoverSum: 600,
                stockSum: 300,
                stockQuantity: 3,
                coefficient: 2,
            },
        ]);

        expect(total.coefficient).toBeCloseTo(1.75);
    });

    it('coefficient null, если ни одна строка не имеет посчитанного коэффициента', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate('warehouse-1', [
            {
                turnoverSum: 100,
                stockSum: 100,
                stockQuantity: 1,
                coefficient: null,
            },
        ]);

        expect(total.coefficient).toBeNull();
    });

    it('coefficient null и нулевые суммы для пустого списка строк', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate('warehouse-1', []);

        expect(total.coefficient).toBeNull();
        expect(total.turnoverSum).toBe(0);
        expect(total.stockSum).toBe(0);
        expect(total.stockQuantity).toBe(0);
    });

    it('игнорирует при взвешивании строки без посчитанного коэффициента', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate('warehouse-1', [
            {
                turnoverSum: 200,
                stockSum: 200,
                stockQuantity: 1,
                coefficient: 1,
            },
            {
                turnoverSum: 900,
                stockSum: 900,
                stockQuantity: 1,
                coefficient: null,
            },
        ]);

        expect(total.coefficient).toBe(1);
    });
});
