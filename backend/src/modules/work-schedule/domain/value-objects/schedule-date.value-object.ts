import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Календарный день записи графика. ПОЧЕМУ value object, а не голая строка/
// Date: «5 августа» — это день, а не момент времени, и единственный
// безопасный способ не потерять сутки на границе часовых поясов — держать
// разбор и форматирование в одном месте. Внутри — строка YYYY-MM-DD,
// наружу в БД (колонка @db.Date) — Date в UTC-полночь; тот же UTC-принцип,
// что и у Period (shared/domain/period.value-object.ts), чтобы день записи
// и границы расчётного месяца не разъезжались.
export class ScheduleDate extends ValueObject<string> {
    static create(value: string): ScheduleDate {
        if (!DATE_PATTERN.test(value)) {
            throw new ArgumentInvalidException(
                `Дата графика должна быть в формате YYYY-MM-DD, получено: "${value}"`,
            );
        }
        // Regexp пропускает несуществующие дни (2026-02-31, 2026-04-31):
        // Date нормализует их в следующий месяц, поэтому сверяем результат
        // разбора с исходной строкой — расхождение означает, что такого
        // дня в календаре нет.
        const parsed = new Date(`${value}T00:00:00.000Z`);
        if (
            Number.isNaN(parsed.getTime()) ||
            ScheduleDate.format(parsed) !== value
        ) {
            throw new ArgumentInvalidException(
                `Такой календарной даты не существует: "${value}"`,
            );
        }
        return new ScheduleDate({ value });
    }

    // Обратный путь из персистентности: Prisma отдаёт колонку @db.Date как
    // Date в UTC-полночь.
    static fromDate(date: Date): ScheduleDate {
        return ScheduleDate.create(ScheduleDate.format(date));
    }

    getValue(): string {
        return this.props.value;
    }

    toDate(): Date {
        return new Date(`${this.props.value}T00:00:00.000Z`);
    }

    private static format(date: Date): string {
        const year = String(date.getUTCFullYear()).padStart(4, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}
