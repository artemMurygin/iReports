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

/**
 * Mirrors `periodSchema`'s regex (`contracts/commands/sales-plan.ts`, 4-digit year + month
 * 01-12) rather than importing that schema — see `PeriodPicker`'s comment for why a *runtime*
 * import from `ireports-contracts` currently breaks the Vite dev server for this workspace
 * package (a real, verified limitation, not a style choice), and `employee-hours-entry.ts` for
 * a precedent of this same format being independently redefined elsewhere in the codebase.
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

/** '1' -> 'категория', '2' -> 'категории', '5'/'11' -> 'категорий' (Russian plural rules). */
export function pluralizeCategories(count: number): string {
    const mod10 = count % 10
    const mod100 = count % 100

    if (mod10 === 1 && mod100 !== 11) return 'категория'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'категории'
    return 'категорий'
}
