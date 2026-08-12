import { ArgumentInvalidException } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { DateRange } from './date-range.value-object';

describe('DateRange', () => {
    describe('create', () => {
        it('принимает валидный диапазон дат', () => {
            const range = DateRange.create('2026-01-01', '2026-01-31');

            expect(range.getFrom().toISOString()).toBe(
                '2026-01-01T00:00:00.000Z',
            );
            expect(range.getTo().toISOString()).toBe(
                '2026-01-31T00:00:00.000Z',
            );
        });

        it('принимает диапазон в один день (from === to)', () => {
            const range = DateRange.create(
                '2026-01-01T00:00:00Z',
                '2026-01-01T00:00:00Z',
            );

            expect(range.getFrom().getTime()).toBe(range.getTo().getTime());
        });

        it.each([
            ['', '2026-01-31'],
            ['2026-01-01', ''],
            ['not-a-date', '2026-01-31'],
            ['2026-01-01', 'not-a-date'],
        ])(
            'отклоняет невалидный формат даты: from="%s", to="%s"',
            (from, to) => {
                withRequestContext(() => {
                    expect(() => DateRange.create(from, to)).toThrow(
                        ArgumentInvalidException,
                    );
                });
            },
        );

        it('отклоняет диапазон, где from позже to', () => {
            withRequestContext(() => {
                expect(() =>
                    DateRange.create('2026-02-01', '2026-01-01'),
                ).toThrow(ArgumentInvalidException);
            });
        });
    });
});
