import { distributeMonthlyHours } from './distribute-monthly-hours';

// 31 дата — с запасом на любой месяц, тесты ниже используют только первые
// несколько.
const dates = Array.from(
    { length: 31 },
    (_, index) => `2026-08-${String(index + 1).padStart(2, '0')}`,
);

describe('distributeMonthlyHours', () => {
    it('0 часов — пустой список чанков', () => {
        expect(distributeMonthlyHours(0, dates)).toEqual([]);
    });

    it('часы в пределах одной смены (2-16) — один чанк на первую доступную дату', () => {
        expect(distributeMonthlyHours(8, dates)).toEqual([
            { date: '2026-08-01', hours: 8 },
        ]);
    });

    it('ровно кратно 16 — несколько полных смен без остатка', () => {
        expect(distributeMonthlyHours(32, dates)).toEqual([
            { date: '2026-08-01', hours: 16 },
            { date: '2026-08-02', hours: 16 },
        ]);
    });

    it('остаток >= 2 часов — отдельный последний чанк с точным остатком', () => {
        const chunks = distributeMonthlyHours(137.25, dates);
        expect(chunks).toHaveLength(9);
        expect(chunks.slice(0, 8)).toEqual(
            dates.slice(0, 8).map((date) => ({ date, hours: 16 })),
        );
        expect(chunks[8]).toEqual({ date: '2026-08-09', hours: 9.25 });
        // Сумма чанков совпадает с исходным значением ТОЧНО — это и есть
        // критерий готовности миграции (PayPerHour.quantity не меняется).
        expect(chunks.reduce((sum, chunk) => sum + chunk.hours, 0)).toBeCloseTo(
            137.25,
            10,
        );
    });

    it('остаток < 2 часов — перекладывает недостачу с предпоследнего (всегда полного) чанка', () => {
        const chunks = distributeMonthlyHours(16.5, dates);
        expect(chunks).toEqual([
            { date: '2026-08-01', hours: 14.5 },
            { date: '2026-08-02', hours: 2 },
        ]);
        expect(chunks.reduce((sum, chunk) => sum + chunk.hours, 0)).toBe(16.5);
    });

    it('единственный чанк меньше минимальной смены — бросает ошибку, а не искажает сумму', () => {
        expect(() => distributeMonthlyHours(1.5, dates)).toThrow(
            /меньше минимальной смены/,
        );
    });

    it('не хватает свободных дней месяца — бросает ошибку', () => {
        expect(() => distributeMonthlyHours(48, dates.slice(0, 2))).toThrow(
            /не помещаются в свободные дни месяца/,
        );
    });
});
