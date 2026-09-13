import { shopGoodsTurnoverReportResponseSchema } from 'ireports-contracts';

// Контрактные тесты `contracts/commands/shop-goods-turnover-report.ts` (shop) — проверяют смену
// формы ответа с голого массива строк на `{lines, totals}` (FR5, BREAKING). Задача 2.1
// openspec/changes/add-department-head-salary-rules/tasks.md.

const line = {
    categoryId: 'cat-1',
    warehouseId: 'wh-1',
    turnoverQuantity: 5,
    turnoverSum: 12830000, // копейки — до .transform в рубли
    stockQuantity: 12,
    stockSum: 30000000,
    coefficient: 1.1,
};

describe('shopGoodsTurnoverReportResponseSchema — смена формы ответа (FR5, BREAKING)', () => {
    // FR5: единственный сегодняшний потребитель (frontend этого же приложения) обновляется в
    // этом же change — старый голый массив больше не валиден по новому контракту.
    it('отклоняет старую форму ответа — голый массив строк', () => {
        const result = shopGoodsTurnoverReportResponseSchema.safeParse([line]);
        expect(result.success).toBe(false);
    });

    // FR5: новая форма — { lines, totals }.
    it('принимает новую форму ответа { lines, totals }', () => {
        const result = shopGoodsTurnoverReportResponseSchema.safeParse({
            lines: [line],
            totals: [
                {
                    warehouseId: 'wh-1',
                    turnoverSum: 12830000,
                    stockSum: 30000000,
                    stockQuantity: 12,
                    coefficient: 1.1,
                },
            ],
        });
        expect(result.success).toBe(true);
    });

    // FR5: totals обязателен наравне с lines.
    it('отклоняет ответ без поля totals', () => {
        const result = shopGoodsTurnoverReportResponseSchema.safeParse({
            lines: [line],
        });
        expect(result.success).toBe(false);
    });

    // FR5: totals.turnoverSum/stockSum — те же копейки-в-рубли transform, что и у line
    // (design.md Decision 6a/b: та же формула, независимо реализованная).
    it('переводит totals.turnoverSum/stockSum из копеек в рубли через transform', () => {
        const result = shopGoodsTurnoverReportResponseSchema.parse({
            lines: [line],
            totals: [
                {
                    warehouseId: 'wh-1',
                    turnoverSum: 12830000,
                    stockSum: 30000000,
                    stockQuantity: 12,
                    coefficient: 1.1,
                },
            ],
        });
        expect(result.totals[0].turnoverSum).toBe(128300);
        expect(result.totals[0].stockSum).toBe(300000);
    });

    // FR5: coefficient = null — коэффициент не рассчитан, допустимое значение totals.
    it('принимает totals с coefficient = null', () => {
        const result = shopGoodsTurnoverReportResponseSchema.safeParse({
            lines: [line],
            totals: [
                {
                    warehouseId: 'wh-1',
                    turnoverSum: 12830000,
                    stockSum: 30000000,
                    stockQuantity: 12,
                    coefficient: null,
                },
            ],
        });
        expect(result.success).toBe(true);
    });

    // Регрессия: пустой отчёт (lines и totals пустые) остаётся валидным.
    it('принимает пустой ответ { lines: [], totals: [] }', () => {
        const result = shopGoodsTurnoverReportResponseSchema.safeParse({
            lines: [],
            totals: [],
        });
        expect(result.success).toBe(true);
    });
});
