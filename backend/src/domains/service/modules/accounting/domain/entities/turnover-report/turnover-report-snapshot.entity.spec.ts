import { TurnoverReportSnapshot } from './turnover-report-snapshot.entity';

// tasks.md задача 6.1 (openspec/changes/add-department-head-salary-rules, design.md Decision 6b):
// TurnoverReportSnapshot — read-модель accounting-модуля для правила DepartmentTurnoverBonus (FR4),
// восстанавливаемая из тех же данных, что goods_turnover_report_lines, но собственной entity этого
// модуля (не импортирует ничего из domains/service/modules/warehouse).
describe('TurnoverReportSnapshot', () => {
    const buildSnapshot = () =>
        TurnoverReportSnapshot.create({
            period: '2026-08',
            warehouseId: 10,
            lines: [
                {
                    categoryId: 1,
                    outcomeSum: 100,
                    stockSum: 100,
                    stockQuantity: 5,
                    turnoverRatio: 1,
                },
                {
                    categoryId: 2,
                    outcomeSum: 600,
                    stockSum: 300,
                    stockQuantity: 10,
                    turnoverRatio: 2,
                },
                // подкатегория 1 — не должна попасть в итог по складу (не корневая)
                {
                    categoryId: 3,
                    outcomeSum: 9999,
                    stockSum: 9999,
                    stockQuantity: 99,
                    turnoverRatio: 5,
                },
            ],
        });

    // FR4: восстановление снапшота из уже прочитанных строк — период/склад/строки доступны как есть
    it('восстанавливает период, склад и строки', () => {
        const snapshot = buildSnapshot();

        expect(snapshot.period).toBe('2026-08');
        expect(snapshot.warehouseId).toBe(10);
        expect(snapshot.lines).toHaveLength(3);
    });

    describe('ratioForCategory', () => {
        // FR4, design.md Decision 2: "при заданной category — берёт коэффициент конкретной строки"
        it('возвращает turnoverRatio строки с указанной категорией', () => {
            const snapshot = buildSnapshot();

            expect(snapshot.ratioForCategory(2)).toBe(2);
        });

        it('null, если такой категории в снапшоте нет', () => {
            const snapshot = buildSnapshot();

            expect(snapshot.ratioForCategory(999)).toBeNull();
        });

        it('null, если у строки коэффициент не рассчитан', () => {
            const snapshot = TurnoverReportSnapshot.create({
                period: '2026-08',
                warehouseId: 10,
                lines: [
                    {
                        categoryId: 1,
                        outcomeSum: 0,
                        stockSum: 0,
                        stockQuantity: 0,
                        turnoverRatio: null,
                    },
                ],
            });

            expect(snapshot.ratioForCategory(1)).toBeNull();
        });
    });

    describe('total', () => {
        // FR4, design.md Decision 6b: "при category = null — берёт агрегат по всему складу из своей
        // TurnoverReportSnapshot" — только строки настоящих корневых категорий (rootCategoryIds).
        it('считает итог только по строкам настоящих корневых категорий', () => {
            const snapshot = buildSnapshot();

            const total = snapshot.total(new Set([1, 2]));

            expect(total.warehouseId).toBe(10);
            expect(total.outcomeSum).toBe(700);
            expect(total.stockSum).toBe(400);
            expect(total.stockQuantity).toBe(15);
            // (1*100 + 2*300) / 400 = 1.75
            expect(total.turnoverRatio).toBeCloseTo(1.75);
        });

        it('пустой набор rootCategoryIds — нулевой итог', () => {
            const snapshot = buildSnapshot();

            const total = snapshot.total(new Set());

            expect(total.outcomeSum).toBe(0);
            expect(total.turnoverRatio).toBeNull();
        });
    });
});
