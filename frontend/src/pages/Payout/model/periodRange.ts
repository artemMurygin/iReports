/**
 * «YYYY-MM» -> ISO-границы месяца (UTC) — тот же хелпер, что
 * `pages/EmployeeBalance/model/periodRange.ts` (задублирован намеренно: страницы не могут
 * импортировать друг друга, frontend/CLAUDE.md). Нужен здесь для ленты последних движений в
 * `PayoutDrawer` — запрашивается только за месяц страницы, не весь баланс сотрудника.
 */
export function periodToDateRange(period: string): { from: string; to: string } {
    const match = /^(\d{4})-(\d{2})$/.exec(period)
    if (!match) return { from: period, to: period }

    const [, year, month] = match
    const from = new Date(Date.UTC(Number(year), Number(month) - 1, 1))
    const to = new Date(Date.UTC(Number(year), Number(month), 0, 23, 59, 59, 999))
    return { from: from.toISOString(), to: to.toISOString() }
}
