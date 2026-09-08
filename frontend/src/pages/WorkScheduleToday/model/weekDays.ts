// Лента дней недели мобильного экрана «Отдел сегодня» (узел `A5SbT` дизайна, `design/sallary-
// first-iteration.pen`) — ровно 7 карточек, понедельник-воскресенье недели, содержащей «сегодня»,
// а не весь календарный месяц, как настольная вкладка «Календарь» (`buildMonthDays` в
// `pages/WorkSchedule/model/scheduleDays.ts`). Своя, независимая от неё реализация — та же причина
// дублирования, что и у `model/today.ts` этой же страницы (см. её комментарий).

export type WeekDayMeta = {
    /** `YYYY-MM-DD`. */
    date: string
    /** Число месяца — подпись `Num` в карточке дня. */
    day: number
    /** Двухбуквенное название дня недели с заглавной буквы («Пн», «Вт», ...) — подпись `Weekday`
     * карточки дня. Заглавная буква (не строчная, как `WEEKDAY_SHORT` в `scheduleDays.ts`) —
     * дизайн мобильного экрана капитализирует её (узел `A5SbT`), десктопная таблица — нет. */
    weekdayShort: string
    isWeekend: boolean
    isToday: boolean
}

/** Индекс — `Date.getUTCDay()` (0 = воскресенье), тот же порядок, что и `WEEKDAY_SHORT` в
 * `pages/WorkSchedule/model/scheduleDays.ts`, только с заглавной буквы. */
const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

/** Понедельник ISO-недели, содержащей `dateIso`. `Date.UTC` — тем же приёмом, что и
 * `buildMonthDays`/`shiftMonth`: день недели календарной даты не должен зависеть от часового
 * пояса браузера. */
function mondayOfWeek(dateIso: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso)
    if (!match) throw new Error(`Invalid date: ${dateIso}`)

    const [, yearStr, monthStr, dayStr] = match
    const date = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr)))
    const weekday = date.getUTCDay()
    // Воскресенье (0) отстоит от своего понедельника на 6 дней назад, остальные дни — на
    // (weekday - 1) дней назад.
    const daysSinceMonday = weekday === 0 ? 6 : weekday - 1
    date.setUTCDate(date.getUTCDate() - daysSinceMonday)
    return date
}

/** 7 дней недели (пн-вс), содержащей `todayIso` — единственный источник дат для ленты недели и
 * подсветки «сегодня»/выходных, переиспользуемый и рендером ленты, и подбором счётчиков людей в
 * смене по дню (`useWorkScheduleTodayPage`). */
export function buildWeekDays(todayIso: string): WeekDayMeta[] {
    const monday = mondayOfWeek(todayIso)

    const days: WeekDayMeta[] = []
    for (let offset = 0; offset < 7; offset++) {
        const current = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + offset))
        const weekday = current.getUTCDay()
        const date = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-${String(current.getUTCDate()).padStart(2, '0')}`

        days.push({
            date,
            day: current.getUTCDate(),
            weekdayShort: WEEKDAY_SHORT[weekday],
            isWeekend: weekday === 0 || weekday === 6,
            isToday: date === todayIso,
        })
    }
    return days
}
