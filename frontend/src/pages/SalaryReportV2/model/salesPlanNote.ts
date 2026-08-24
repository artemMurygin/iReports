const MONTHS_CAPITALIZED = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
]

/**
 * "Август 2026 · 18 из 31 дня" (Pencil: `EG4ns`'s `I8BvCO` "Note") — количество прошедших дней
 * месяца не приходит с бэкенда (`DirectionReportVM.salesPerformance`/`period` не несут его),
 * считается на фронте так же, как страничный `getCurrentPeriod` в
 * `features/SalaryReportData/model/useSalaryReportSelection.ts` считает текущий период: для
 * периода, совпадающего с текущим месяцем — день `now`; для уже прошедшего периода — весь месяц
 * (план на нём больше не "в процессе"); для периода в будущем (выбор наперёд не запрещён фильтром)
 * — 0 из месяца, ничего ещё не прошло.
 *
 * "дня" в подписи — как в единственном сэмпле дизайна ("18 из 31 дня"), не согласуется падежом с
 * числом месяца (не "31 день"/"31 дня" по правилам множественного числа) — это устоявшийся для UI
 * оборот вида "X из Y", а не грамматическая форма, привязанная к Y, поэтому здесь не полньй
 * плюрализатор, а фиксированное слово, как в макете.
 */
export function formatSalesPlanNote(period: string): string {
    const match = /^(\d{4})-(\d{2})$/.exec(period)
    if (!match) return period

    const year = Number(match[1])
    const monthIndex = Number(match[2]) - 1
    const monthName = MONTHS_CAPITALIZED[monthIndex]
    if (!monthName) return period

    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
    const now = new Date()
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === monthIndex
    const isPastMonth = year < now.getFullYear() || (year === now.getFullYear() && monthIndex < now.getMonth())
    const daysPassed = isCurrentMonth ? now.getDate() : isPastMonth ? daysInMonth : 0

    return `${monthName} ${year} · ${daysPassed} из ${daysInMonth} дня`
}
