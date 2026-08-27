// Чистые форматтеры периода/денег/процентов. Исторически жили в
// features/SalesPlan/model/format.ts, но по правилу frontend/CLAUDE.md («паттерн,
// который начинает повторяться в ≥2 страницах/фичах, выносится в shared») переехали
// сюда, когда понадобились второй фиче — features/AccountingPeriod (диалог закрытия
// месяца, Фаза 4 docs/payroll-closing-and-accrual): кросс-импорты между features
// запрещены линтингом, а страница-посредник не может «подарить» одной фиче форматтеры
// другой. features/SalesPlan/model/format.ts реэкспортирует всё отсюда, поэтому
// существующие импорты (`@/features/SalesPlan`) не изменились.

const MONTHS_NOMINATIVE = [
    'январь',
    'февраль',
    'март',
    'апрель',
    'май',
    'июнь',
    'июль',
    'август',
    'сентябрь',
    'октябрь',
    'ноябрь',
    'декабрь',
]

/** '2026-06' -> 'июнь 2026'. Falls back to the raw string if it doesn't match `YYYY-MM`. */
export function formatPeriodLabel(period: string): string {
    const match = /^(\d{4})-(\d{2})$/.exec(period)
    if (!match) return period

    const [, year, month] = match
    const monthName = MONTHS_NOMINATIVE[Number(month) - 1]
    return monthName ? `${monthName} ${year}` : period
}

/** '2026-06' -> 'июнь' — bare month name for button labels («Начисления за июнь»). */
export function formatPeriodMonthName(period: string): string {
    const match = /^(\d{4})-(\d{2})$/.exec(period)
    if (!match) return period

    return MONTHS_NOMINATIVE[Number(match[2]) - 1] ?? period
}

const MONTHS_GENITIVE = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
]

/** '2026-07' -> 'июля' — родительный падеж («Часы июля станут доступны только для чтения»). */
export function formatPeriodMonthGenitive(period: string): string {
    const match = /^(\d{4})-(\d{2})$/.exec(period)
    if (!match) return period

    return MONTHS_GENITIVE[Number(match[2]) - 1] ?? period
}

/**
 * Mirrors `periodSchema`'s regex (`contracts/commands/sales-plan.ts`, 4-digit year + month
 * 01-12) rather than importing that schema — see `PeriodPicker`'s comment for why a *runtime*
 * import from `ireports-contracts` currently breaks the Vite dev server for this workspace
 * package (a real, verified limitation, not a style choice), and `work-schedule.ts`'s own
 * `workScheduleMonthSchema` for a precedent of this same format being independently redefined
 * elsewhere in the codebase.
 */
export function isValidPeriod(period: string): boolean {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(period)
}

/**
 * '2026-06' + 1 -> '2026-07', '2026-01' + (-1) -> '2025-12'. Used by `PeriodPicker`'s
 * previous/next-month arrows. `Date`'s own month rollover (month index 12/-1 normalizes into
 * the next/previous year) does the carrying, so no manual year-boundary branching is needed —
 * `Date.UTC` (not local time) avoids DST-adjacent off-by-one shifts.
 */
export function shiftPeriod(period: string, deltaMonths: number): string {
    const match = /^(\d{4})-(\d{2})$/.exec(period)
    if (!match) return period

    const [, year, month] = match
    const shifted = new Date(Date.UTC(Number(year), Number(month) - 1 + deltaMonths, 1))
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Rounded, thousands-grouped number, no currency suffix — for values whose "₽" already lives in a column/field label (e.g. mobile `PlanCard`'s "План, ₽" label). */
export function formatNumber(amount: number): string {
    return Math.round(amount).toLocaleString('ru-RU')
}

export function formatCurrency(amount: number): string {
    return `${formatNumber(amount)} ₽`
}

/** Same as `formatCurrency`, but prefixes a `+`/`−` sign — for deltas like "прогноз к плану". */
export function formatSignedCurrency(amount: number): string {
    const rounded = Math.round(amount)
    const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
    return `${sign}${formatCurrency(Math.abs(rounded))}`
}

/** Whole-percent ratio of `part` to `whole`, e.g. `formatPercent(71, 100)` -> '71%'. Returns '0%' when `whole` is 0. */
export function formatPercent(part: number, whole: number): string {
    if (whole === 0) return '0%'
    return `${Math.round((part / whole) * 100)}%`
}

/** One-decimal-place ratio (Russian comma), e.g. '35,3%'. Returns '0%' when `whole` is 0. */
export function formatPercentPrecise(part: number, whole: number): string {
    if (whole === 0) return '0%'
    return `${((part / whole) * 100).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

/**
 * Explicit table rather than `Intl.DateTimeFormat('ru-RU', { month: 'short' })` — that locale
 * formatter's exact output (trailing "." after the abbreviation, a trailing "г." after the year)
 * varies across ICU/Node versions and doesn't match the mockups' style ("12 авг 2026"), so a
 * fixed table is the only way to render it reliably everywhere. Originally lived only in
 * `pages/SalaryRuleList/model/formatUpdatedAt.ts`; promoted here (frontend/CLAUDE.md: a pattern
 * repeating in ≥2 places moves to `shared`) when `pages/EmployeeSettlements` needed the same
 * "day short-month year" shape for its "Последнее движение"/"Данные на" columns — pages can't
 * import one another, so the second place couldn't just reuse the first's local helper.
 */
const SHORT_MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

/** '12 авг 2026' — day + short month + year, no trailing periods. Accepts a `Date` or an
 * ISO/parseable date string; `null` (no movement/timestamp yet) -> '—'. */
export function formatShortDate(date: Date | string | null): string {
    if (date === null) return '—'
    const value = typeof date === 'string' ? new Date(date) : date
    return `${value.getDate()} ${SHORT_MONTHS[value.getMonth()]} ${value.getFullYear()}`
}

/** '25 авг 2026, 14:30' — `formatShortDate` plus HH:mm, for "Данные на …" freshness notes. */
export function formatShortDateTime(date: Date | number): string {
    const value = typeof date === 'number' ? new Date(date) : date
    const time = `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
    return `${formatShortDate(value)}, ${time}`
}
