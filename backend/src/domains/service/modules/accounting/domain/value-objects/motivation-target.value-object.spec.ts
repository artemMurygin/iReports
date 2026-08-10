import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { MotivationTarget } from './motivation-target.value-object';

describe('MotivationTarget', () => {
    describe('create', () => {
        it('создаёт цель на сотрудника', () => {
            const target = MotivationTarget.create('Employee', 42);

            expect(target.getType()).toBe('Employee');
            expect(target.getId()).toBe(42);
            expect(target.isEmployee()).toBe(true);
            expect(target.isDepartment()).toBe(false);
        });

        it('создаёт цель на отдел', () => {
            const target = MotivationTarget.create('Department', 3);

            expect(target.isDepartment()).toBe(true);
            expect(target.isEmployee()).toBe(false);
        });

        it('отклоняет недопустимый type', () => {
            withRequestContext(() => {
                expect(() =>
                    MotivationTarget.create('' as 'Employee', 42),
                ).toThrow(ArgumentInvalidException);
            });
        });

        it('отклоняет отсутствующий id', () => {
            withRequestContext(() => {
                expect(() => MotivationTarget.create('Employee', 0)).toThrow(
                    ArgumentInvalidException,
                );
            });
        });
    });

    describe('equals', () => {
        it('равны цели с одинаковыми type/id', () => {
            expect(
                MotivationTarget.create('Employee', 42).equals(
                    MotivationTarget.create('Employee', 42),
                ),
            ).toBe(true);
        });

        it('не равны цели с разным id', () => {
            expect(
                MotivationTarget.create('Employee', 42).equals(
                    MotivationTarget.create('Employee', 43),
                ),
            ).toBe(false);
        });
    });
});
