import type { BalanceSummaryTotals } from 'ireports-contracts'

import { pluralizeEmployees } from '@/features/SalaryReportData'
import { formatCurrency } from '@/shared/lib/format.ts'

export type SettlementsKpiCardVM = {
    key: 'balance' | 'toPay' | 'debt'
    label: string
    value: string
    note: string
}

/**
 * Pencil `IFJW2` KPI Row: «Общий остаток» / «К выплате сотрудникам» / «Долг сотрудников
 * компании» — pure derivation from `BalanceSummaryResponse.totals` (already scoped to the
 * current department/search filter by the backend, PRD: "показатели ... пересчитываются
 * только по сотрудникам этого отдела"), kept separate from `EmployeeSettlementsKpiRow` so the
 * label/value/note strings are unit-testable without rendering. `value` is `formatCurrency`
 * as-is (no `formatSignedCurrency`) — `totals.debt.amount` already carries its own minus sign
 * (see `balanceSummaryTotalsSchema`'s comment), and "К выплате" never needs a leading "+" per
 * the mockup.
 */
export function buildSettlementsKpiCards(totals: BalanceSummaryTotals, employeesCount: number): SettlementsKpiCardVM[] {
    return [
        {
            key: 'balance',
            label: 'Общий остаток',
            value: formatCurrency(totals.balance),
            note: `${pluralizeEmployees(employeesCount)} · сальдо на текущий момент`,
        },
        {
            key: 'toPay',
            label: 'К выплате сотрудникам',
            value: formatCurrency(totals.toPay.amount),
            note: `${pluralizeEmployees(totals.toPay.count)} с положительным остатком`,
        },
        {
            key: 'debt',
            label: 'Долг сотрудников компании',
            value: formatCurrency(totals.debt.amount),
            note: `${pluralizeEmployees(totals.debt.count)} с отрицательным остатком`,
        },
    ]
}
