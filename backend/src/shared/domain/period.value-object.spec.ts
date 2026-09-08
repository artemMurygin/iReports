import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { Period } from './period.value-object';

describe('Period', () => {
    describe('create', () => {
        it('принимает валидный период в формате YYYY-MM', () => {
            const period = Period.create('2026-08');

            expect(period.getValue()).toBe('2026-08');
        });

        it.each(['2026/08', '2026-13', '2026-00', '26-08', '2026-8', ''])(
            'отклоняет период не в формате YYYY-MM: "%s"',
            (value) => {
                withRequestContext(() => {
                    expect(() => Period.create(value)).toThrow(
                        ArgumentInvalidException,
                    );
                });
            },
        );
    });

    describe('getBounds', () => {
        it('вычисляет первый и последний момент месяца в UTC', () => {
            const { from, to } = Period.create('2026-08').getBounds();

            expect(from.toISOString()).toBe('2026-08-01T00:00:00.000Z');
            expect(to.toISOString()).toBe('2026-08-31T23:59:59.999Z');
        });

        it('корректно считает последний день февраля', () => {
            const { to } = Period.create('2026-02').getBounds();

            expect(to.toISOString()).toBe('2026-02-28T23:59:59.999Z');
        });
    });

    describe('equals', () => {
        it('равны периоды с одинаковым значением', () => {
            expect(
                Period.create('2026-08').equals(Period.create('2026-08')),
            ).toBe(true);
        });

        it('не равны периоды с разным значением', () => {
            expect(
                Period.create('2026-08').equals(Period.create('2026-09')),
            ).toBe(false);
        });
    });

    describe('previous', () => {
        it('возвращает предыдущий месяц внутри года', () => {
            expect(Period.create('2026-08').previous().getValue()).toBe(
                '2026-07',
            );
        });

        it('переносит январь в декабрь предыдущего года', () => {
            expect(Period.create('2026-01').previous().getValue()).toBe(
                '2025-12',
            );
        });
    });

    describe('current', () => {
        it('вычисляет текущий период по UTC-дате', () => {
            jest.useFakeTimers().setSystemTime(
                new Date('2026-08-15T12:00:00.000Z'),
            );

            expect(Period.current().getValue()).toBe('2026-08');

            jest.useRealTimers();
        });
    });

    describe('getTotalCalendarDays', () => {
        it('возвращает число дней месяца', () => {
            expect(Period.create('2026-08').getTotalCalendarDays()).toBe(31);
        });

        it('корректно считает февраль', () => {
            expect(Period.create('2026-02').getTotalCalendarDays()).toBe(28);
        });
    });

    describe('getElapsedCalendarDays', () => {
        // Решение зафиксировано (Фаза 5, docs/payroll/plan-payroll-calculation.md):
        // день считается прошедшим, только когда он уже целиком закончился —
        // текущие, ещё не завершившиеся сутки не в счёт.
        it('0 в первую же минуту месяца — ни один день ещё не закончился', () => {
            const period = Period.create('2026-08');
            const now = new Date('2026-08-01T00:00:00.000Z');

            expect(period.getElapsedCalendarDays(now)).toBe(0);
        });

        it('день не засчитывается прошедшим до его окончания', () => {
            const period = Period.create('2026-08');
            const now = new Date('2026-08-01T23:59:59.999Z');

            expect(period.getElapsedCalendarDays(now)).toBe(0);
        });

        it('день засчитывается прошедшим ровно с начала следующих суток', () => {
            const period = Period.create('2026-08');
            const now = new Date('2026-08-02T00:00:00.000Z');

            expect(period.getElapsedCalendarDays(now)).toBe(1);
        });

        it('в середине месяца считает ровно прошедшие сутки', () => {
            const period = Period.create('2026-08');
            const now = new Date('2026-08-15T12:00:00.000Z');

            expect(period.getElapsedCalendarDays(now)).toBe(14);
        });

        it('зажимает результат числом дней месяца, если now позже конца периода (закрытый/прошлый месяц)', () => {
            const period = Period.create('2026-08');
            const now = new Date('2026-12-01T00:00:00.000Z');

            expect(period.getElapsedCalendarDays(now)).toBe(31);
        });

        it('зажимает результат нулём, если now раньше начала периода', () => {
            const period = Period.create('2026-08');
            const now = new Date('2026-07-01T00:00:00.000Z');

            expect(period.getElapsedCalendarDays(now)).toBe(0);
        });
    });
});
