import { ChevronRight, CornerDownRight } from 'lucide-react'
import type { DepartmentSalaryReportEmployee } from 'ireports-contracts'

import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'

import { formatFloatPercentRange } from '../model/formatFloatPercentRange.ts'
import { getRoleLabel } from '../model/labels.ts'
import { isFloatPercentRule } from '../model/types.ts'

import { RuleTypeIcon } from './RuleTypeIcon.tsx'

export type EmployeesTableProps = {
    employees: DepartmentSalaryReportEmployee[]
    isClosed: boolean
    isEmployeeExpanded: (employeeId: number) => boolean
    onToggleEmployee: (employeeId: number) => void
    className?: string
}

const TABLE_COLUMNS = 'grid-cols-[36px_minmax(0,1fr)_90px_150px_150px]'
const RULES_COLUMNS = 'grid-cols-[minmax(0,1fr)_130px_140px_140px]'

function getInitials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
}

/** Роль сотрудника отдела в человекочитаемом виде — контракт (`DepartmentSalaryReportEmployee`)
 * не хранит роль отдельным полем, только по факту через `targetRole` его собственных правил
 * (`employeeSalaryReportRuleSchema`), поэтому берётся роль первого правила. */
function getEmployeeRoleLabel(employee: DepartmentSalaryReportEmployee): string | null {
    const role = employee.rules[0]?.targetRole
    return role ? getRoleLabel(role) : null
}

function formatAmountOrDash(value: number | null): string {
    return value === null ? '—' : formatCurrency(value)
}

/**
 * Pencil: `b6mfxv`'s "Employees Table" (`t4OHw`) — десктопная таблица сотрудников отдела:
 * экспандер · Сотрудник (аватар-инициалы + имя + роль) · Правил · Факт · Прогноз. Разворот строки
 * (`WW7Ox` "Expansion · Правила …") показывает плоский список правил сотрудника — БЕЗ заказов
 * (`sources[]`) и без собственных экспандеров у правил, в отличие от разбивки в отчёте сотрудника.
 */
export function EmployeesTable({ employees, isClosed, isEmployeeExpanded, onToggleEmployee, className }: EmployeesTableProps) {
    return (
        <div data-slot="employees-table" className={cn('overflow-hidden rounded-lg border border-hairline', className)}>
            <div className={cn('grid items-center gap-3 border-b border-hairline bg-canvas px-3 py-2', TABLE_COLUMNS)}>
                <span />
                <span className="font-ui text-xs text-ink">Сотрудник</span>
                <span className="text-right font-ui text-xs text-ink-muted">Правил</span>
                <span className="text-right font-ui text-xs text-ink">Факт, ₽</span>
                <span className="text-right font-ui text-xs text-ink-muted">Прогноз, ₽</span>
            </div>

            {employees.map((employee, index) => {
                const expanded = isEmployeeExpanded(employee.employeeId)
                const roleLabel = getEmployeeRoleLabel(employee)

                return (
                    <div key={employee.employeeId} className={cn(index > 0 && 'border-t border-hairline')}>
                        <button
                            type="button"
                            onClick={() => onToggleEmployee(employee.employeeId)}
                            aria-expanded={expanded}
                            className={cn(
                                'grid w-full items-center gap-3 px-3 py-3 text-left transition-colors',
                                expanded ? 'bg-row-selected' : 'hover:bg-canvas',
                                TABLE_COLUMNS,
                            )}
                        >
                            <ChevronRight
                                className={cn(
                                    'size-4 shrink-0 text-ink-muted transition-transform duration-150',
                                    expanded && 'rotate-90',
                                )}
                            />
                            <span className="flex min-w-0 items-center gap-2.5">
                                <Avatar>
                                    <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                                </Avatar>
                                <span className="flex min-w-0 flex-col">
                                    <span className="truncate font-ui text-[13px] font-semibold text-ink">{employee.name}</span>
                                    {roleLabel && <span className="truncate font-ui text-xs text-ink-muted">{roleLabel}</span>}
                                </span>
                            </span>
                            <span className="text-right font-ui text-[13px] text-ink tabular-nums">{employee.rules.length}</span>
                            <span className="text-right font-ui text-[13px] font-bold text-ink tabular-nums">
                                {formatCurrency(employee.total.fact)}
                            </span>
                            <span className="text-right font-ui text-[13px] font-bold text-ink-muted tabular-nums">
                                {formatAmountOrDash(employee.total.prognose)}
                            </span>
                        </button>

                        {expanded && (
                            <div className="flex gap-2 border-t border-hairline bg-canvas/50 py-3 pr-3 pl-9">
                                <CornerDownRight className="mt-2 size-3.5 shrink-0 text-ink-faint" />
                                <div className="min-w-0 flex-1 overflow-hidden rounded-[10px] border border-hairline bg-surface">
                                    <div
                                        className={cn(
                                            'grid items-center gap-3 border-b border-hairline bg-canvas px-3 py-1.5',
                                            RULES_COLUMNS,
                                        )}
                                    >
                                        <span className="font-ui text-[11px] text-ink">Правило</span>
                                        <span className="text-right font-ui text-[11px] text-ink-muted">%, факт → прогноз</span>
                                        <span className="text-right font-ui text-[11px] text-ink">Факт, ₽</span>
                                        <span className="text-right font-ui text-[11px] text-ink-muted">Прогноз, ₽</span>
                                    </div>
                                    {employee.rules.map((rule, ruleIndex) => {
                                        const percentLabel = formatFloatPercentRange(rule, isClosed)
                                        const metaLabel = isFloatPercentRule(rule)
                                            ? 'Плавающий процент (KPI)'
                                            : 'Фиксированная ставка'

                                        return (
                                            <div
                                                key={rule.ruleId}
                                                className={cn(
                                                    'grid items-center gap-3 px-3 py-2',
                                                    RULES_COLUMNS,
                                                    ruleIndex > 0 && 'border-t border-hairline',
                                                )}
                                            >
                                                <span className="flex min-w-0 items-center gap-2">
                                                    <RuleTypeIcon rule={rule} />
                                                    <span className="flex min-w-0 flex-col">
                                                        <span className="truncate font-ui text-[13px] font-medium text-ink">
                                                            {rule.name}
                                                        </span>
                                                        <span className="truncate font-ui text-[11px] text-ink-muted">
                                                            {metaLabel}
                                                        </span>
                                                    </span>
                                                </span>
                                                <span className="text-right font-ui text-[13px] font-semibold text-ink tabular-nums">
                                                    {percentLabel}
                                                </span>
                                                <span className="text-right font-ui text-[13px] font-bold text-ink tabular-nums">
                                                    {formatCurrency(rule.amount.fact)}
                                                </span>
                                                <span className="text-right font-ui text-[13px] font-bold text-ink-muted tabular-nums">
                                                    {formatAmountOrDash(rule.amount.prognose)}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

export { getInitials }
