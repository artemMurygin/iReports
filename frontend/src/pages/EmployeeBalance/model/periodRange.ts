/**
 * «YYYY-MM» -> ISO-границы месяца (00:00:00.000 первого числа .. 23:59:59.999
 * последнего), UTC — та же граница, что `Period.getBounds()` на бэкенде (см.
 * `isPeriodExpired` в `features/AccountingPeriod/model/periodDates.ts`).
 * Локальный хелпер страницы (не `features/SalesPlan`/`shared/lib/format.ts`):
 * фильтр `from`/`to` ленты баланса — единственное место в проекте, которому
 * нужен диапазон дат месяца, а не просто его подпись/сдвиг.
 */
export function periodToDateRange(period: string): { from: string; to: string } {
    const match = /^(\d{4})-(\d{2})$/.exec(period)
    if (!match) return { from: period, to: period }

    const [, year, month] = match
    const from = new Date(Date.UTC(Number(year), Number(month) - 1, 1))
    const to = new Date(Date.UTC(Number(year), Number(month), 0, 23, 59, 59, 999))
    return { from: from.toISOString(), to: to.toISOString() }
}
