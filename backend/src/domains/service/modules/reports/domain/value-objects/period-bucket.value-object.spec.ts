import { PeriodBucket } from './period-bucket.value-object';

// Паритет с getPeriodBucketKey/generatePeriodKeys (src/TODO/reports/
// reports.helpers.ts, удалены этой же фазой) — фиксирует ожидаемые ключи
// напрямую (Фаза 5 "Когда готово": "разбивка по периодам воспроизводит
// текущие ключи периодов (тест на PeriodBucket)"), а не сравнением с уже
// удалённой легаси-функцией.
describe('PeriodBucket', () => {
    describe('keyFor', () => {
        it('day — ключ равен самой дате (UTC, без времени)', () => {
            const bucket = PeriodBucket.create('day');
            expect(bucket.keyFor(new Date('2026-01-15T18:30:00.000Z'))).toBe(
                '2026-01-15',
            );
        });

        it('week — ключ равен ближайшему предыдущему понедельнику (ISO-неделя)', () => {
            const bucket = PeriodBucket.create('week');
            // 2026-01-15 — четверг
            expect(bucket.keyFor(new Date('2026-01-15T00:00:00.000Z'))).toBe(
                '2026-01-12',
            );
            // 2026-01-12 — сам понедельник, остаётся собой
            expect(bucket.keyFor(new Date('2026-01-12T23:59:59.000Z'))).toBe(
                '2026-01-12',
            );
            // 2026-01-18 — воскресенье, относится к неделе, начавшейся 12-го
            expect(bucket.keyFor(new Date('2026-01-18T00:00:00.000Z'))).toBe(
                '2026-01-12',
            );
        });

        it('month — ключ равен 1-му числу месяца', () => {
            const bucket = PeriodBucket.create('month');
            expect(bucket.keyFor(new Date('2026-02-27T12:00:00.000Z'))).toBe(
                '2026-02-01',
            );
        });
    });

    describe('generateKeys', () => {
        it('day — последовательные даты от from до to включительно', () => {
            const bucket = PeriodBucket.create('day');
            const keys = bucket.generateKeys(
                new Date('2026-01-01T00:00:00.000Z'),
                new Date('2026-01-03T00:00:00.000Z'),
            );
            expect(keys).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
        });

        it('week — по понедельникам, диапазон нормализуется к границам недель', () => {
            const bucket = PeriodBucket.create('week');
            const keys = bucket.generateKeys(
                new Date('2026-01-14T00:00:00.000Z'), // среда недели с 12-го
                new Date('2026-01-21T00:00:00.000Z'), // среда следующей недели
            );
            expect(keys).toEqual(['2026-01-12', '2026-01-19']);
        });

        it('month — по 1-м числам', () => {
            const bucket = PeriodBucket.create('month');
            const keys = bucket.generateKeys(
                new Date('2026-01-20T00:00:00.000Z'),
                new Date('2026-03-05T00:00:00.000Z'),
            );
            expect(keys).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
        });

        // Оба момента внутри одного и того же дня и намеренно не рядом с
        // границей суток UTC (00:00/24:00) — bucketStart() определяет
        // календарный день ЛОКАЛЬНЫМИ геттерами Date (см. комментарий в
        // period-bucket.value-object.ts), поэтому момент, близкий к
        // полуночи UTC, при часовом поясе процесса backend, отличном от
        // UTC, может попасть в соседний календарный день — это
        // унаследованная особенность легаси-расчёта, а не то, что
        // проверяет этот тест.
        it('from === to даёт один ключ', () => {
            const bucket = PeriodBucket.create('day');
            const keys = bucket.generateKeys(
                new Date('2026-05-01T08:00:00.000Z'),
                new Date('2026-05-01T15:00:00.000Z'),
            );
            expect(keys).toEqual(['2026-05-01']);
        });
    });
});
