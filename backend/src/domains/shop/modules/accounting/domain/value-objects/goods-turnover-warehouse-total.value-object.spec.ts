import { GoodsTurnoverWarehouseTotal } from './goods-turnover-warehouse-total.value-object';

// tasks.md задача 7.1 (openspec/changes/add-department-head-salary-rules): зеркало задачи 6 для
// shop — третья независимая реализация формулы «сумма по настоящим корневым строкам +
// средневзвешенный по остатку коэффициент» (design.md Decision 6b), внутри модуля accounting/shop,
// не переиспользует domains/shop/modules/warehouse (root CLAUDE.md).
describe('GoodsTurnoverWarehouseTotal.calculate (accounting/shop)', () => {
    // FR4: суммирование показателей по переданным строкам одного склада
    it('суммирует turnoverSum/stockSum/stockQuantity по переданным строкам', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate('wh-1', [
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

        expect(total.warehouseId).toBe('wh-1');
        expect(total.turnoverSum).toBe(160);
        expect(total.stockSum).toBe(320);
        expect(total.stockQuantity).toBe(6);
    });

    // FR4: средневзвешенный по stockSum коэффициент — (1*100 + 2*300) / 400 = 1.75
    it('считает средневзвешенный по stockSum коэффициент по строкам с посчитанным coefficient', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate('wh-1', [
            {
                turnoverSum: 100,
                stockSum: 100,
                stockQuantity: 0,
                coefficient: 1,
            },
            {
                turnoverSum: 600,
                stockSum: 300,
                stockQuantity: 0,
                coefficient: 2,
            },
        ]);

        expect(total.coefficient).toBeCloseTo(1.75);
    });

    // FR4: коэффициент не рассчитан ни для одной строки -> итог null, а не 0
    it('coefficient null, если ни одна строка не имеет посчитанного коэффициента', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate('wh-1', [
            {
                turnoverSum: 0,
                stockSum: 100,
                stockQuantity: 0,
                coefficient: null,
            },
        ]);

        expect(total.coefficient).toBeNull();
    });

    // FR4: пустой список строк — валидный нулевой итог, не ошибка
    it('coefficient null и нулевые суммы для пустого списка строк', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate('wh-1', []);

        expect(total.coefficient).toBeNull();
        expect(total.turnoverSum).toBe(0);
        expect(total.stockSum).toBe(0);
        expect(total.stockQuantity).toBe(0);
    });

    // FR4: строки без посчитанного коэффициента не участвуют во взвешивании
    it('игнорирует при взвешивании строки без посчитанного коэффициента', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate('wh-1', [
            {
                turnoverSum: 200,
                stockSum: 200,
                stockQuantity: 0,
                coefficient: 1,
            },
            {
                turnoverSum: 900,
                stockSum: 900,
                stockQuantity: 0,
                coefficient: null,
            },
        ]);

        expect(total.coefficient).toBe(1);
    });
});
