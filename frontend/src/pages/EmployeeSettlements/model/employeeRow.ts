import type { BalanceSummaryEmployee } from 'ireports-contracts'

import { employeeInitials } from '@/features/SalaryAccruals'
import { formatCurrency, formatShortDate } from '@/shared/lib/format.ts'

/**
 * Row view model for `EmployeeSettlementsTable` — one place that turns the raw API row
 * (`BalanceSummaryEmployee`) into display-ready strings/flags, so the table component itself
 * stays presentational (frontend/CLAUDE.md: `model`/`ui` split for a component with its own
 * derivation logic) and the formatting rules below are unit-testable without rendering anything.
 */
export type EmployeeSettlementsRowVM = {
    employeeId: number
    initials: string
    name: string
    position: string | null
    departmentName: string
    lastMovementLabel: string
    balanceLabel: string
    isNegative: boolean
    /** «Уволен» badge (PRD, В скоупе): сотрудник уволен по данным Bitrix24, но остаётся в
     * списке из-за ненулевого баланса — GetBalanceSummaryService уже отдаёт таких сотрудников
     * (isDismissed), фильтрации на фронте не требуется. */
    isDismissed: boolean
}

export function buildEmployeeRowVM(employee: BalanceSummaryEmployee): EmployeeSettlementsRowVM {
    return {
        employeeId: employee.employeeId,
        initials: employeeInitials(employee.employeeName),
        name: employee.employeeName,
        position: employee.position,
        departmentName: employee.departmentName,
        lastMovementLabel: formatShortDate(employee.lastMovementAt),
        balanceLabel: formatCurrency(employee.balance),
        isNegative: employee.balance < 0,
        isDismissed: employee.isDismissed,
    }
}
