import { ShopTaskCompletion } from './shop-task-completion.entity';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { ShopTaskCompletionInvalidStatusTransitionException } from '@/domains/shop/modules/accounting/domain/exceptions/shop-task-completion.exception';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('ShopTaskCompletion', () => {
    describe('create', () => {
        it('создаёт запись в статусе PENDING_CONFIRMATION', () => {
            const completion = ShopTaskCompletion.create({
                employeeId: 42,
                period: '2026-08',
                description: 'Обновил прайс на сайте',
                createdBy: 42,
            });

            expect(completion.id).toEqual(expect.any(String));
            expect(completion.employeeId).toBe(42);
            expect(completion.period).toBe('2026-08');
            expect(completion.status).toBe('PENDING_CONFIRMATION');
            expect(completion.confirmedBy).toBeNull();
            expect(completion.confirmedAt).toBeNull();
            expect(completion.isConfirmed()).toBe(false);
        });

        it('отклоняет пустое описание', () => {
            withRequestContext(() => {
                expect(() =>
                    ShopTaskCompletion.create({
                        employeeId: 42,
                        period: '2026-08',
                        description: '   ',
                        createdBy: 42,
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });

        it('отклоняет период не в формате YYYY-MM', () => {
            withRequestContext(() => {
                expect(() =>
                    ShopTaskCompletion.create({
                        employeeId: 42,
                        period: '2026/08',
                        description: 'Задача',
                        createdBy: 42,
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });
    });

    describe('confirm', () => {
        it('переводит запись в CONFIRMED и фиксирует, кто и когда подтвердил', () => {
            const completion = ShopTaskCompletion.create({
                employeeId: 42,
                period: '2026-08',
                description: 'Задача',
                createdBy: 42,
            });

            completion.confirm(7);

            expect(completion.status).toBe('CONFIRMED');
            expect(completion.confirmedBy).toBe(7);
            expect(completion.confirmedAt).toBeInstanceOf(Date);
            expect(completion.isConfirmed()).toBe(true);
        });

        it('отклоняет повторное подтверждение уже решённой записи', () => {
            const completion = ShopTaskCompletion.create({
                employeeId: 42,
                period: '2026-08',
                description: 'Задача',
                createdBy: 42,
            });
            completion.confirm(7);

            withRequestContext(() => {
                expect(() => completion.confirm(7)).toThrow(
                    ShopTaskCompletionInvalidStatusTransitionException,
                );
            });
        });
    });

    describe('reject', () => {
        it('переводит запись в REJECTED', () => {
            const completion = ShopTaskCompletion.create({
                employeeId: 42,
                period: '2026-08',
                description: 'Задача',
                createdBy: 42,
            });

            completion.reject(7);

            expect(completion.status).toBe('REJECTED');
            expect(completion.confirmedBy).toBe(7);
            expect(completion.isConfirmed()).toBe(false);
        });
    });
});
