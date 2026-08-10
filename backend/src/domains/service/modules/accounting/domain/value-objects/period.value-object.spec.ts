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
});
