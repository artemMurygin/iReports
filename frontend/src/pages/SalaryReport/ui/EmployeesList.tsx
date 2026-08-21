import { ChevronDown } from 'lucide-react'
import type { DepartmentSalaryReportEmployee } from 'ireports-contracts'

import { formatCurrency } from '@/features/SalesPlan'
import { pluralizeRules } from '@/kernel/pluralizeRules.ts'
import { cn } from '@/shared/lib/tw'

import { formatFloatPercentRange } from '../model/formatFloatPercentRange.ts'
import { getRoleLabel } from '../model/labels.ts'
import { isFloatPercentRule } from '../model/types.ts'

import { RuleTypeIcon } from './RuleTypeIcon.tsx'

export type EmployeesListProps = {
    employees: DepartmentSalaryReportEmployee[]
    isClosed: boolean
    isEmployeeExpanded: (employeeId: number) => boolean
    onToggleEmployee: (employeeId: number) => void
    className?: string
}

function getEmployeeRoleLabel(employee: DepartmentSalaryReportEmployee): string | null {
    const role = employee.rules[0]?.targetRole
    return role ? getRoleLabel(role) : null
}

/**
 * Pencil: `d8XFk`'s "Employees List" (`H3NuRU`) — карточки сотрудников отдела для мобильного
 * брейкпоинта (`EmployeesTable`'s аналог для `md:`): имя + «Роль · N правил» слева, факт крупно/
 * «→ прогноз» приглушённо справа, шеврон; разворот показывает плоский список правил (название +
 * проценты у KPI-правил / «Фиксированная сумма» у остальных), без заказов.
 */
export function EmployeesList({ employees, isClosed, isEmployeeExpanded, onToggleEmployee, className }: EmployeesListProps) {
    return (
        <div data-slot="employees-list" className={cn('flex flex-col gap-2', className)}>
            {employees.map((employee) => {
                const expanded = isEmployeeExpanded(employee.employeeId)
                const roleLabel = getEmployeeRoleLabel(employee)
                const roleAndCount = [roleLabel, pluralizeRules(employee.rules.length)].filter(Boolean).join(' · ')

                return (
                    <div key={employee.employeeId} className="overflow-hidden rounded-xl border border-hairline bg-surface">
                        <button
                            type="button"
                            onClick={() => onToggleEmployee(employee.employeeId)}
                            aria-expanded={expanded}
                            className={cn(
                                'flex w-full items-center justify-between gap-3 p-3 text-left',
                                expanded && 'bg-row-selected',
                            )}
                        >
                            <span className="flex min-w-0 flex-col gap-0.5">
                                <span className="truncate font-ui text-sm font-semibold text-ink">{employee.name}</span>
                                <span className="truncate font-ui text-xs text-ink-muted">{roleAndCount}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                                <span className="flex flex-col items-end gap-0.5">
                                    <span className="font-ui text-sm font-semibold text-ink tabular-nums">
                                        {formatCurrency(employee.total.fact)}
                                    </span>
                                    <span className="font-ui text-xs text-ink-muted tabular-nums">
                                        {employee.total.prognose === null
                                            ? isClosed
                                                ? 'Месяц закрыт'
                                                : '—'
                                            : `→ ${formatCurrency(employee.total.prognose)}`}
                                    </span>
                                </span>
                                <ChevronDown
                                    className={cn(
                                        'size-4 shrink-0 text-ink-muted transition-transform duration-150',
                                        expanded && 'rotate-180',
                                    )}
                                />
                            </span>
                        </button>

                        {expanded && (
                            <div className="flex flex-col border-t border-hairline">
                                {employee.rules.map((rule) => {
                                    const isFloatPercent = isFloatPercentRule(rule)
                                    const percentLabel = formatFloatPercentRange(rule, isClosed)
                                    const metaLabel = isFloatPercent
                                        ? percentLabel
                                            ? `${percentLabel} · KPI`
                                            : 'KPI'
                                        : 'Фиксированная сумма'

                                    return (
                                        <div
                                            key={rule.ruleId}
                                            className="flex items-center justify-between gap-2 border-b border-hairline p-2.5 last:border-b-0"
                                        >
                                            <span className="flex min-w-0 items-center gap-2">
                                                <RuleTypeIcon rule={rule} />
                                                <span className="flex min-w-0 flex-col">
                                                    <span className="truncate font-ui text-[13px] font-medium text-ink">
                                                        {rule.name}
                                                    </span>
                                                    <span
                                                        className={cn(
                                                            'truncate font-ui text-[11px]',
                                                            isFloatPercent ? 'font-semibold text-ink' : 'text-ink-muted',
                                                        )}
                                                    >
                                                        {metaLabel}
                                                    </span>
                                                </span>
                                            </span>
                                            <span className="flex shrink-0 flex-col items-end">
                                                <span className="font-ui text-[13px] font-bold text-ink tabular-nums">
                                                    {formatCurrency(rule.amount.fact)}
                                                </span>
                                                <span className="font-ui text-[11px] text-ink-muted tabular-nums">
                                                    {rule.amount.prognose === null ? '—' : formatCurrency(rule.amount.prognose)}
                                                </span>
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
