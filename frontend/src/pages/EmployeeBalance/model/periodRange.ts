/**
 * Текущий календарный месяц (`YYYY-MM`) — отправная точка, когда пользователь решает СУЗИТЬ
 * ленту «за всё время» (дефолт Фазы 8 docs/employee-settlements-page-redesign) до конкретного
 * месяца через `PeriodPicker` (`BalanceActions`). НЕ переиспользует `DEFAULT_PERIOD` из
 * `features/SalesPlan` (зафиксированный демо-период отчётности, `2026-06`): движения ленты,
 * включая `SALARY_ACCRUAL`, несут `occurredAt` — дату фактического проведения ("сейчас"), а не
 * расчётный период — поэтому отправная точка сужения должна быть месяцем по системным часам.
 */
export function currentMonthPeriod(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

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
