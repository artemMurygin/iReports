// Форматтеры для страницы плана продаж — вынесены сюда (а не в pages/SalesPlan), т.к.
// используются и в pages/SalesPlan/ui/PageHeader.tsx (Period Chip), и в
// features/SalesPlan/ui/KpiRow.tsx (подписи карточек), а по правилам FSD страница может
// импортировать из feature, но не наоборот (см. frontend/CLAUDE.md).

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

/** '1' -> 'категория', '2' -> 'категории', '5'/'11' -> 'категорий' (Russian plural rules). */
export function pluralizeCategories(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100

    if (mod10 === 1 && mod100 !== 11) return 'категория'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'категории'
    return 'категорий'
}
