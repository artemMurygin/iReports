import { Period } from '@/shared/domain/period.value-object';
import { ScheduleDate } from '../value-objects/schedule-date.value-object';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Список календарных дней месяца в формате YYYY-MM-DD, по порядку с 1-го
// числа — столбцы таблицы «сотрудники × дни месяца» (Фаза 3, PRD:
// "28-31 ячейку на сотрудника"). Через ScheduleDate.fromDate (а не
// собственное форматирование Date → строка), чтобы формат дня графика не
// разъезжался с тем, что использует WorkScheduleEntry.date в остальном
// модуле — единое место разбора/форматирования (см. комментарий над
// ScheduleDate).
export function buildMonthDates(period: Period): string[] {
    const totalDays = period.getTotalCalendarDays();
    const { from } = period.getBounds();

    const dates: string[] = [];
    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
        const date = new Date(from.getTime() + dayOffset * MS_PER_DAY);
        dates.push(ScheduleDate.fromDate(date).getValue());
    }
    return dates;
}
