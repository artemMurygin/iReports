import { getGoodsTurnoverReportResponseSchema } from 'ireports-contracts';

// Контрактные тесты `contracts/commands/goods-turnover-report.ts` (service) — проверяют
// аддитивное поле `totals` в ответе отчёта «Оборачиваемость» (FR5). Задача 2.1
// openspec/changes/add-department-head-salary-rules/tasks.md.

const line = {
    categoryId: 1,
    categoryName: 'iPhone',
    categoryParentId: null,
    warehouseId: 10,
    warehouseName: 'Основной склад',
    outcomeQuantity: 5,
    outcomeSum: 128300,
    stockQuantity: 12,
    stockSum: 300000,
    turnoverRatio: 1.1,
};

describe('getGoodsTurnoverReportResponseSchema — totals (FR5)', () => {
    // FR5: ответ дополняется полем totals — итоговая строка по складу (сумма, количество,
    // коэффициент по всем категориям склада), design.md Decision 6a.
    it('принимает ответ с непустыми lines и totals', () => {
        const result = getGoodsTurnoverReportResponseSchema.safeParse({
            period: '2025-01',
            lines: [line],
            totals: [
                {
                    warehouseId: 10,
                    outcomeSum: 128300,
                    stockSum: 300000,
                    stockQuantity: 12,
                    turnoverRatio: 1.1,
                },
            ],
        });
        expect(result.success).toBe(true);
    });

    // FR5: период без пересчёта — валидный пустой ответ и для lines, и для totals (design.md D5).
    it('принимает ответ с пустыми lines и пустыми totals', () => {
        const result = getGoodsTurnoverReportResponseSchema.safeParse({
            period: '2025-01',
            lines: [],
            totals: [],
        });
        expect(result.success).toBe(true);
    });

    // FR5: turnoverRatio итоговой строки — null, когда коэффициент не рассчитан (не 0).
    it('принимает totals с turnoverRatio = null', () => {
        const result = getGoodsTurnoverReportResponseSchema.safeParse({
            period: '2025-01',
            lines: [line],
            totals: [
                {
                    warehouseId: 10,
                    outcomeSum: 128300,
                    stockSum: 300000,
                    stockQuantity: 12,
                    turnoverRatio: null,
                },
            ],
        });
        expect(result.success).toBe(true);
    });

    // FR5: totals — обязательное поле ответа (backend всегда считает его тем же проходом, что
    // строит lines), ответ без него больше не соответствует контракту.
    it('отклоняет ответ без поля totals', () => {
        const result = getGoodsTurnoverReportResponseSchema.safeParse({
            period: '2025-01',
            lines: [line],
        });
        expect(result.success).toBe(false);
    });

    // FR5: элемент totals без warehouseId невалиден — по одной записи на склад, иначе не
    // отличить итог одного склада от другого.
    it('отклоняет элемент totals без warehouseId', () => {
        const result = getGoodsTurnoverReportResponseSchema.safeParse({
            period: '2025-01',
            lines: [line],
            totals: [
                {
                    outcomeSum: 128300,
                    stockSum: 300000,
                    stockQuantity: 12,
                    turnoverRatio: 1.1,
                },
            ],
        });
        expect(result.success).toBe(false);
    });

    // Регрессия: существующее поле lines не поменяло форму.
    it('регрессия — форма line не изменилась', () => {
        const result = getGoodsTurnoverReportResponseSchema.safeParse({
            period: '2025-01',
            lines: [line],
            totals: [],
        });
        expect(result.success).toBe(true);
    });
});
