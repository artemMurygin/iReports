import { ShopTaskStatus } from './task-status.value-object';

// Раздел 14 tasks.md (add-task-based-salary-rule) — независимая копия
// теста (зеркало domains/service/modules/accounting/domain/value-objects/
// task-status.value-object.spec.ts, раздел 9, issue #57). isDone()
// истинен только для кода "5" ("Завершена" в Bitrix24 Tasks API,
// проверено через mcp__claude_ai_Bitrix_24__bitrix-method-details —
// см. WHY в task-status.value-object.ts), любой другой сырой код —
// не выполнено.
describe('ShopTaskStatus', () => {
    it('isDone() истинен для кода "5" (Завершена)', () => {
        const status = ShopTaskStatus.fromRaw('5');

        expect(status.isDone()).toBe(true);
    });

    it.each(['1', '2', '3', '4', '6', '7'])(
        'isDone() ложен для кода "%s" (не "Завершена")',
        (rawCode) => {
            const status = ShopTaskStatus.fromRaw(rawCode);

            expect(status.isDone()).toBe(false);
        },
    );

    it('ShopTaskStatus.done() возвращает статус, для которого isDone() истинен', () => {
        expect(ShopTaskStatus.done().isDone()).toBe(true);
    });

    // Раздел 16 tasks.md (add-task-based-salary-rule) —
    // EnsureShopSalaryTaskForPeriodService проставляет этот статус только
    // что созданной в Bitrix24 задаче: он обязан быть НЕ "Завершена"
    // (иначе свежесозданная задача считалась бы сразу выполненной).
    it('ShopTaskStatus.newlyCreated() возвращает статус, для которого isDone() ложен', () => {
        expect(ShopTaskStatus.newlyCreated().isDone()).toBe(false);
    });

    it('getValue() возвращает исходный сырой код без преобразований', () => {
        expect(ShopTaskStatus.fromRaw('3').getValue()).toBe('3');
    });
});
