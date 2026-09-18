import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { DeadlinePeriodOffset } from './deadline-period-offset.value-object';

// recurring-task-deadline-offset, tasks.md 2.1 — смещение дедлайна регулярной задачи
// TaskCompletion относительно расчётного периода: 0..3 периода вперёд (design.md решение 2).
describe('DeadlinePeriodOffset', () => {
    describe('create', () => {
        it.each([0, 1, 2, 3])('принимает валидное значение %i', (value) => {
            const offset = DeadlinePeriodOffset.create(value);

            expect(offset.getValue()).toBe(value);
        });

        it('отклоняет отрицательное значение', () => {
            withRequestContext(() => {
                expect(() => DeadlinePeriodOffset.create(-1)).toThrow(
                    ArgumentInvalidException,
                );
            });
        });

        it('отклоняет значение больше 3', () => {
            withRequestContext(() => {
                expect(() => DeadlinePeriodOffset.create(4)).toThrow(
                    ArgumentInvalidException,
                );
            });
        });

        it('отклоняет дробное значение', () => {
            withRequestContext(() => {
                expect(() => DeadlinePeriodOffset.create(1.5)).toThrow(
                    ArgumentInvalidException,
                );
            });
        });
    });
});
