import { TurnoverReportSnapshot } from './turnover-report-snapshot.entity';

// tasks.md задача 7.1 (openspec/changes/add-department-head-salary-rules, design.md Decision 6b):
// зеркало задачи 6 (accounting/service) для shop — read-модель accounting/shop для правила
// DepartmentTurnoverBonus (FR4), не импортирует ничего из domains/shop/modules/warehouse.
describe('TurnoverReportSnapshot (shop)', () => {
    const buildSnapshot = () =>
        TurnoverReportSnapshot.create({
            period: '2026-08',
            warehouseId: 'wh-10',
            lines: [
                {
                    categoryId: 'cat-1',
                    turnoverSum: 100,
                    stockSum: 100,
                    stockQuantity: 5,
                    coefficient: 1,
                },
                {
                    categoryId: 'cat-2',
                    turnoverSum: 600,
                    stockSum: 300,
                    stockQuantity: 10,
                    coefficient: 2,
                },
                // подкатегория cat-1 — не должна попасть в итог по складу (не корневая)
                {
                    categoryId: 'cat-3',
                    turnoverSum: 9999,
                    stockSum: 9999,
                    stockQuantity: 99,
                    coefficient: 5,
                },
            ],
        });

    it('восстанавливает период, склад и строки', () => {
        const snapshot = buildSnapshot();

        expect(snapshot.period).toBe('2026-08');
        expect(snapshot.warehouseId).toBe('wh-10');
        expect(snapshot.lines).toHaveLength(3);
    });

    describe('coefficientForCategory', () => {
        // FR4, design.md Decision 2: "при заданной category — берёт коэффициент конкретной строки"
        it('возвращает coefficient строки с указанной категорией', () => {
            const snapshot = buildSnapshot();

            expect(snapshot.coefficientForCategory('cat-2')).toBe(2);
        });

        it('null, если такой категории в снапшоте нет', () => {
            const snapshot = buildSnapshot();

            expect(snapshot.coefficientForCategory('unknown')).toBeNull();
        });

        it('null, если у строки коэффициент не рассчитан', () => {
            const snapshot = TurnoverReportSnapshot.create({
                period: '2026-08',
                warehouseId: 'wh-10',
                lines: [
                    {
                        categoryId: 'cat-1',
                        turnoverSum: 0,
                        stockSum: 0,
                        stockQuantity: 0,
                        coefficient: null,
                    },
                ],
            });

            expect(snapshot.coefficientForCategory('cat-1')).toBeNull();
        });
    });

    describe('total', () => {
        // FR4, design.md Decision 6b: только строки настоящих корневых категорий (rootCategoryIds)
        it('считает итог только по строкам настоящих корневых категорий', () => {
            const snapshot = buildSnapshot();

            const total = snapshot.total(new Set(['cat-1', 'cat-2']));

            expect(total.warehouseId).toBe('wh-10');
            expect(total.turnoverSum).toBe(700);
            expect(total.stockSum).toBe(400);
            expect(total.stockQuantity).toBe(15);
            // (1*100 + 2*300) / 400 = 1.75
            expect(total.coefficient).toBeCloseTo(1.75);
        });

        it('пустой набор rootCategoryIds — нулевой итог', () => {
            const snapshot = buildSnapshot();

            const total = snapshot.total(new Set());

            expect(total.turnoverSum).toBe(0);
            expect(total.coefficient).toBeNull();
        });
    });
});
