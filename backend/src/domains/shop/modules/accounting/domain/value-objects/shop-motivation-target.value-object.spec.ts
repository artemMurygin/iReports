import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { ShopMotivationTarget } from './shop-motivation-target.value-object';

describe('ShopMotivationTarget', () => {
    describe('create', () => {
        it('создаёт цель на сотрудника', () => {
            const target = ShopMotivationTarget.create('Employee', 42);

            expect(target.getType()).toBe('Employee');
            expect(target.getId()).toBe(42);
            expect(target.isEmployee()).toBe(true);
            expect(target.isDepartment()).toBe(false);
        });

        it('создаёт цель на отдел', () => {
            const target = ShopMotivationTarget.create('Department', 3);

            expect(target.isDepartment()).toBe(true);
            expect(target.isEmployee()).toBe(false);
        });

        it('отклоняет недопустимый type', () => {
            withRequestContext(() => {
                expect(() =>
                    ShopMotivationTarget.create('' as 'Employee', 42),
                ).toThrow(ArgumentInvalidException);
            });
        });

        it('отклоняет отсутствующий id', () => {
            withRequestContext(() => {
                expect(() =>
                    ShopMotivationTarget.create('Employee', 0),
                ).toThrow(ArgumentInvalidException);
            });
        });
    });

    describe('equals', () => {
        it('равны цели с одинаковыми type/id', () => {
            expect(
                ShopMotivationTarget.create('Employee', 42).equals(
                    ShopMotivationTarget.create('Employee', 42),
                ),
            ).toBe(true);
        });

        it('не равны цели с разным id', () => {
            expect(
                ShopMotivationTarget.create('Employee', 42).equals(
                    ShopMotivationTarget.create('Employee', 43),
                ),
            ).toBe(false);
        });
    });
});
