import { ValueObject } from '@/shared/domain/value-object.base';

export type PeriodGranularity = 'day' | 'week' | 'month';

export interface PeriodBucketProps {
    granularity: PeriodGranularity;
}

// Гранулярность разбивки аналитики услуг по периодам (`groupBy` в GET
// /v1/service/reports/services, Фаза 5) — перенос getPeriodBucketKey/
// generatePeriodKeys (src/TODO/reports/reports.helpers.ts) БУКВАЛЬНО, без
// изменения бизнес-правила (см. "Не в скоупе" PRD): неделя начинается с
// понедельника (ISO), месяц — с 1 числа. bucketStart() ниже сохраняет и
// особенность легаси-реализации, которая выглядит как расчёт в UTC, но им
// не является: календарный день берётся ЛОКАЛЬНЫМИ геттерами Date
// (getFullYear/getMonth/getDate — часовой пояс сервера), а затем
// пересобирается как UTC-полночь этого дня (Date.UTC(...)) — то есть
// граница бакета фактически зависит от TZ процесса backend, а не от даты в
// UTC. Это унаследованная особенность легаси-кода, не новое поведение —
// сознательно не исправлена этой фазой.
export class PeriodBucket extends ValueObject<PeriodBucketProps> {
    static create(granularity: PeriodGranularity): PeriodBucket {
        return new PeriodBucket({ granularity });
    }

    getGranularity(): PeriodGranularity {
        return this.props.granularity;
    }

    // Ключ бакета, которому принадлежит date — начало дня/недели/месяца в
    // формате YYYY-MM-DD (перенос getPeriodBucketKey).
    keyFor(date: Date): string {
        return this.bucketStart(date).toISOString().slice(0, 10);
    }

    // Последовательность ключей всех бакетов от from до to включительно —
    // даже пустых, без единой продажи (перенос generatePeriodKeys); нужна,
    // чтобы breakdown в ответе не терял периоды без данных.
    generateKeys(from: Date, to: Date): string[] {
        const keys: string[] = [];
        const end = this.bucketStart(to);
        let cursor = this.bucketStart(from);

        while (cursor <= end) {
            keys.push(cursor.toISOString().slice(0, 10));
            cursor = this.increment(cursor);
        }

        return keys;
    }

    private bucketStart(date: Date): Date {
        const d = new Date(
            Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
        );

        if (this.props.granularity === 'month') {
            d.setUTCDate(1);
        } else if (this.props.granularity === 'week') {
            const day = d.getUTCDay();
            const diffToMonday = day === 0 ? -6 : 1 - day;
            d.setUTCDate(d.getUTCDate() + diffToMonday);
        }

        return d;
    }

    private increment(date: Date): Date {
        const next = new Date(date);
        if (this.props.granularity === 'day')
            next.setUTCDate(next.getUTCDate() + 1);
        else if (this.props.granularity === 'week')
            next.setUTCDate(next.getUTCDate() + 7);
        else next.setUTCMonth(next.getUTCMonth() + 1);
        return next;
    }
}
