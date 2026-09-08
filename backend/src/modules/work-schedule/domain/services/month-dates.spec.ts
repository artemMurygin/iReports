import { buildMonthDates } from './month-dates';
import { Period } from '@/shared/domain/period.value-object';

describe('buildMonthDates', () => {
    it('строит 31 день для месяца с 31 днём (август)', () => {
        const dates = buildMonthDates(Period.create('2026-08'));

        expect(dates).toHaveLength(31);
        expect(dates[0]).toBe('2026-08-01');
        expect(dates[dates.length - 1]).toBe('2026-08-31');
    });

    it('строит 28 дней для февраля невисокосного года', () => {
        const dates = buildMonthDates(Period.create('2026-02'));

        expect(dates).toHaveLength(28);
        expect(dates[dates.length - 1]).toBe('2026-02-28');
    });

    it('строит 29 дней для февраля високосного года', () => {
        const dates = buildMonthDates(Period.create('2028-02'));

        expect(dates).toHaveLength(29);
        expect(dates[dates.length - 1]).toBe('2028-02-29');
    });

    it('дни идут подряд без пропусков', () => {
        const dates = buildMonthDates(Period.create('2026-08'));

        expect(dates).toEqual([
            '2026-08-01',
            '2026-08-02',
            '2026-08-03',
            '2026-08-04',
            '2026-08-05',
            '2026-08-06',
            '2026-08-07',
            '2026-08-08',
            '2026-08-09',
            '2026-08-10',
            '2026-08-11',
            '2026-08-12',
            '2026-08-13',
            '2026-08-14',
            '2026-08-15',
            '2026-08-16',
            '2026-08-17',
            '2026-08-18',
            '2026-08-19',
            '2026-08-20',
            '2026-08-21',
            '2026-08-22',
            '2026-08-23',
            '2026-08-24',
            '2026-08-25',
            '2026-08-26',
            '2026-08-27',
            '2026-08-28',
            '2026-08-29',
            '2026-08-30',
            '2026-08-31',
        ]);
    });
});
