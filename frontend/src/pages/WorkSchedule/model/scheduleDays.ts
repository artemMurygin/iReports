// Календарные дни месяца для заголовка/строк таблицы графика — источник «выделения сегодня и
// выходных» из PRD (раздел «В скоупе»). Один расчёт (buildMonthDays) переиспользуется и шапкой
// (ScheduleTableHeaderRow), и телом (для сопоставления ячеек employee.days по дате), и подвалом
// (для сопоставления days[].peopleOnShift по дате) — единый источник true для того, какой день
// сегодня/выходной, вместо трёх независимых вычислений, которые могли бы разойтись.

/** Индекс — `Date.getUTCDay()` (0 = воскресенье). `Date.UTC` (а не локальная `Date`) — то же
 * решение, что и в `model/format.ts`'s `shiftMonth`: день недели календарной даты не должен
 * зависеть от часового пояса браузера. */
const WEEKDAY_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

export type ScheduleDayMeta = {
    /** `YYYY-MM-DD` — тот же формат, что и `WorkScheduleDayCell.date`/`WorkScheduleDayAggregate.date`. */
    date: string
    /** Число месяца (1-31) — подпись в заголовке. */
    day: number
    weekdayShort: string
    isWeekend: boolean
    isToday: boolean
}

/** Число дней в месяце `YYYY-MM` (28-31) — день 0 следующего месяца в UTC. */
export function daysInMonthCount(month: string): number {
    const match = /^(\d{4})-(\d{2})$/.exec(month)
    if (!match) return 0

    const [, year, monthNum] = match
    return new Date(Date.UTC(Number(year), Number(monthNum), 0)).getUTCDate()
}

/** Полный список календарных дней месяца с метаданными для рендера. `todayIso` передаётся
 * снаружи (`model/format.ts`'s `getTodayIso`), а не считается внутри — так функция остаётся
 * чистой и легко тестируется с фиксированной «сегодняшней» датой. */
export function buildMonthDays(month: string, todayIso: string): ScheduleDayMeta[] {
    const match = /^(\d{4})-(\d{2})$/.exec(month)
    if (!match) return []

    const [, yearStr, monthNumStr] = match
    const year = Number(yearStr)
    const monthNum = Number(monthNumStr)
    const total = daysInMonthCount(month)

    const days: ScheduleDayMeta[] = []
    for (let day = 1; day <= total; day++) {
        const date = `${yearStr}-${monthNumStr}-${String(day).padStart(2, '0')}`
        const weekday = new Date(Date.UTC(year, monthNum - 1, day)).getUTCDay()
        days.push({
            date,
            day,
            weekdayShort: WEEKDAY_SHORT[weekday],
            isWeekend: weekday === 0 || weekday === 6,
            isToday: date === todayIso,
        })
    }
    return days
}

/** CSS Grid `grid-template-columns` для строк таблицы: липкая колонка сотрудника (196px) +
 * по 32px на день месяца + колонка «Часы» (88px) + резиновая колонка «Отпуск» (мин. 96px).
 * Общая для шапки/строк сотрудников/подвала — иначе колонки трёх независимых flex-рядов могли бы
 * разъехаться на дробных экранных ширинах. */
export function buildScheduleGridTemplate(dayCount: number): string {
    return `196px repeat(${dayCount}, 32px) 88px minmax(96px, 1fr)`
}
