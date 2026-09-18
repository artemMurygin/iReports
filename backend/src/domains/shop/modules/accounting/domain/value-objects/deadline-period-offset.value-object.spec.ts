import { DeadlinePeriodOffset } from './deadline-period-offset.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// recurring-task-deadline-offset, tasks.md раздел 5 (зеркало раздела 2
// направления service — issue #57, собственная независимая копия, не
// импортирует одноимённый класс domains/service). Смещение периода
// дедлайна регулярной задачи правила "за выполнение задачи" — целое число
// в диапазоне [0, 3] (design.md решение 2).
describe('DeadlinePeriodOffset', () => {
    it.each([0, 1, 2, 3])(
        'create(%i) — успешно создаёт значение в допустимом диапазоне',
        (value) => {
            const offset = DeadlinePeriodOffset.create(value);

            expect(offset.getValue()).toBe(value);
        },
    );

    it('create(-1) — бросает ArgumentInvalidException (отрицательное значение)', () => {
        withRequestContext(() => {
            expect(() => DeadlinePeriodOffset.create(-1)).toThrow(
                ArgumentInvalidException,
            );
        });
    });

    it('create(4) — бросает ArgumentInvalidException (за верхней границей)', () => {
        withRequestContext(() => {
            expect(() => DeadlinePeriodOffset.create(4)).toThrow(
                ArgumentInvalidException,
            );
        });
    });

    it('create(1.5) — бросает ArgumentInvalidException (не целое число)', () => {
        withRequestContext(() => {
            expect(() => DeadlinePeriodOffset.create(1.5)).toThrow(
                ArgumentInvalidException,
            );
        });
    });
});
