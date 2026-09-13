import { GoodsTurnoverWarehouseTotal } from './goods-turnover-warehouse-total.value-object';

// tasks.md задача 6.1 (openspec/changes/add-department-head-salary-rules): вторая независимая
// реализация формулы «сумма по настоящим корневым строкам + средневзвешенный по остатку
// коэффициент» (design.md Decision 6b) — внутри модуля accounting, не переиспользует
// domains/service/modules/warehouse (root CLAUDE.md). Тесты зеркалируют
// warehouse/domain/value-objects/goods-turnover-warehouse-total.value-object.spec.ts фикстурами, но
// не импортируют ничего из warehouse.
describe('GoodsTurnoverWarehouseTotal.calculate (accounting/service)', () => {
    // FR4: суммирование показателей по переданным строкам одного склада
    it('суммирует outcomeSum/stockSum/stockQuantity по переданным строкам', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate(1, [
            {
                outcomeSum: 100,
                stockSum: 200,
                stockQuantity: 4,
                turnoverRatio: null,
            },
            {
                outcomeSum: 60,
                stockSum: 120,
                stockQuantity: 2,
                turnoverRatio: null,
            },
        ]);

        expect(total.warehouseId).toBe(1);
        expect(total.outcomeSum).toBe(160);
        expect(total.stockSum).toBe(320);
        expect(total.stockQuantity).toBe(6);
    });

    // FR4: средневзвешенный по stockSum коэффициент — та же фикстура, что и у warehouse/service
    // (1*100 + 2*300) / 400 = 1.75.
    it('считает средневзвешенный по stockSum коэффициент по строкам с посчитанным turnoverRatio', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate(1, [
            {
                outcomeSum: 100,
                stockSum: 100,
                stockQuantity: 0,
                turnoverRatio: 1,
            },
            {
                outcomeSum: 600,
                stockSum: 300,
                stockQuantity: 0,
                turnoverRatio: 2,
            },
        ]);

        expect(total.turnoverRatio).toBeCloseTo(1.75);
    });

    // FR4: коэффициент не рассчитан ни для одной строки -> итог null, а не 0
    it('turnoverRatio null, если ни одна строка не имеет посчитанного коэффициента', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate(1, [
            {
                outcomeSum: 0,
                stockSum: 100,
                stockQuantity: 0,
                turnoverRatio: null,
            },
        ]);

        expect(total.turnoverRatio).toBeNull();
    });

    // FR4: пустой список строк — валидный нулевой итог, не ошибка
    it('turnoverRatio null и нулевые суммы для пустого списка строк', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate(1, []);

        expect(total.turnoverRatio).toBeNull();
        expect(total.outcomeSum).toBe(0);
        expect(total.stockSum).toBe(0);
        expect(total.stockQuantity).toBe(0);
    });

    // FR4: строки без посчитанного коэффициента не участвуют во взвешивании
    it('игнорирует при взвешивании строки без посчитанного коэффициента', () => {
        const total = GoodsTurnoverWarehouseTotal.calculate(1, [
            {
                outcomeSum: 200,
                stockSum: 200,
                stockQuantity: 0,
                turnoverRatio: 1,
            },
            {
                outcomeSum: 900,
                stockSum: 900,
                stockQuantity: 0,
                turnoverRatio: null,
            },
        ]);

        expect(total.turnoverRatio).toBe(1);
    });
});
