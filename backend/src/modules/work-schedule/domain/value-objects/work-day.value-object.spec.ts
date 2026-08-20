import { WorkDay } from './work-day.value-object';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

describe('WorkDay', () => {
    describe('WORKING', () => {
        it('создаёт рабочий день с часами и ролью', () => {
            const day = WorkDay.create({
                status: 'WORKING',
                hours: 8,
                role: 'ENGINEER',
            });

            expect(day.status).toBe('WORKING');
            expect(day.hours).toBe(8);
            expect(day.role).toBe('ENGINEER');
            expect(day.isWorking()).toBe(true);
        });

        it('допускает рабочий день без часов и роли (проставлен заранее)', () => {
            const day = WorkDay.create({ status: 'WORKING' });

            expect(day.hours).toBeNull();
            expect(day.role).toBeNull();
        });

        it('отклоняет невалидные часы через ShiftHours', () => {
            withRequestContext(() => {
                expect(() =>
                    WorkDay.create({ status: 'WORKING', hours: 1 }),
                ).toThrow(ArgumentInvalidException);
            });
        });

        it('отклоняет неизвестную роль', () => {
            withRequestContext(() => {
                expect(() =>
                    WorkDay.create({
                        status: 'WORKING',
                        role: 'НЕИЗВЕСТНАЯ',
                    }),
                ).toThrow(ArgumentInvalidException);
            });
        });
    });

    describe.each(['DAY_OFF', 'TIME_OFF', 'SICK_LEAVE', 'VACATION'] as const)(
        '%s (нерабочий статус)',
        (status) => {
            it('создаётся без часов и роли', () => {
                const day = WorkDay.create({ status });

                expect(day.status).toBe(status);
                expect(day.hours).toBeNull();
                expect(day.role).toBeNull();
                expect(day.isWorking()).toBe(false);
            });

            it('отклоняет часы, переданные вместе с нерабочим статусом', () => {
                withRequestContext(() => {
                    expect(() => WorkDay.create({ status, hours: 8 })).toThrow(
                        ArgumentInvalidException,
                    );
                });
            });

            it('отклоняет роль, переданную вместе с нерабочим статусом', () => {
                withRequestContext(() => {
                    expect(() =>
                        WorkDay.create({ status, role: 'ENGINEER' }),
                    ).toThrow(ArgumentInvalidException);
                });
            });
        },
    );

    it('отклоняет неизвестный статус дня', () => {
        withRequestContext(() => {
            expect(() => WorkDay.create({ status: 'НЕИЗВЕСТНЫЙ' })).toThrow(
                ArgumentInvalidException,
            );
        });
    });
});
