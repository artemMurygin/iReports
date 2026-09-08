import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { BalanceSummaryEmployee, BalanceSummaryTotals } from 'ireports-contracts'

import { pluralizeEmployees } from '@/features/SalaryReportData'
import { formatCurrency } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'

import { groupEmployeesByDepartment } from '../model/departmentGrouping.ts'
import { buildEmployeeRowVM } from '../model/employeeRow.ts'

export type EmployeeSettlementsCardListProps = {
    employees: BalanceSummaryEmployee[]
    totals: BalanceSummaryTotals
    /** `true` только когда фильтр отдела — «Все отделы» (`departmentId === null`,
     * `useEmployeeSettlementsPage`): PRD требует группировку по отделам с подытогом ИМЕННО в
     * этом режиме для мобильной раскладки — выбор конкретного отдела уже сужает `employees` до
     * одного отдела, и повторная "группа из одного элемента" только добавила бы шума. */
    groupByDepartment: boolean
    className?: string
}

/**
 * Pencil `wZnzC` (`Взаиморасчёты с сотрудниками`, мобильная раскладка, Фаза 4
 * docs/employee-settlements-page-redesign): карточный список вместо `EmployeeSettlementsTable`
 * — группировка по отделу с подытогом-заголовком («Отдел сервиса · 5 — 179 500 ₽») в режиме
 * «Все отделы» (`groupByDepartment`, чистая функция `groupEmployeesByDepartment`, unit-tested
 * отдельно), общая строка «Итого · N сотрудников», и текст-подсказка внизу. Карточки строятся
 * из того же `buildEmployeeRowVM`, что и строки десктопной таблицы — форматирование остатка/
 * даты/бейджа «Уволен» не дублируется между раскладками.
 */
function EmployeeSettlementsCardList({
    employees,
    totals,
    groupByDepartment,
    className,
}: EmployeeSettlementsCardListProps) {
    if (employees.length === 0) {
        return (
            <p
                className={cn(
                    'rounded-xl border border-hairline bg-surface px-4 py-8 text-center font-ui text-xs text-ink-muted',
                    className,
                )}
            >
                Нет сотрудников по текущим условиям — измените отдел или поиск.
            </p>
        )
    }

    const groups = groupByDepartment ? groupEmployeesByDepartment(employees) : null

    return (
        <div data-slot="employee-settlements-card-list" className={cn('flex flex-col gap-4', className)}>
            {groups ? (
                groups.map((group) => (
                    <div key={group.departmentId} className="flex flex-col gap-2.5">
                        <div className="flex items-baseline justify-between gap-2 px-1">
                            <span className="font-ui text-sm font-bold text-ink">
                                {group.departmentName}{' '}
                                <span className="font-normal text-ink-muted">· {group.employees.length}</span>
                            </span>
                            <span className="shrink-0 font-ui text-sm font-bold tabular-nums text-ink">
                                {formatCurrency(group.balance)}
                            </span>
                        </div>
                        <div className="flex flex-col gap-2.5">
                            {group.employees.map((employee) => (
                                <EmployeeSettlementsCard key={employee.employeeId} employee={employee} />
                            ))}
                        </div>
                    </div>
                ))
            ) : (
                <div className="flex flex-col gap-2.5">
                    {employees.map((employee) => (
                        <EmployeeSettlementsCard key={employee.employeeId} employee={employee} />
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-surface px-3.5 py-3">
                <span className="font-ui text-sm font-bold text-ink">
                    Итого · {pluralizeEmployees(employees.length)}
                </span>
                <span
                    className={cn(
                        'shrink-0 font-ui text-base font-bold tabular-nums',
                        totals.balance < 0 ? 'text-danger' : 'text-ink',
                    )}
                >
                    {formatCurrency(totals.balance)}
                </span>
            </div>

            <p className="px-1 text-center font-ui text-xs text-ink-faint">
                Нажмите на сотрудника, чтобы открыть карточку баланса и историю движений.
            </p>
        </div>
    )
}

function EmployeeSettlementsCard({ employee }: { employee: BalanceSummaryEmployee }) {
    const row = buildEmployeeRowVM(employee)

    return (
        <Link
            to={`/balance/employee/${row.employeeId}`}
            data-slot="employee-settlements-card"
            className="flex items-center gap-3 rounded-xl border border-hairline bg-surface p-3.5 transition-colors active:bg-canvas"
        >
            <Avatar>
                <AvatarFallback>{row.initials}</AvatarFallback>
            </Avatar>

            <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 truncate font-ui text-sm font-semibold text-brand-strong">
                    {row.name}
                    {row.isDismissed && (
                        <span className="shrink-0 rounded-md bg-danger-soft px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap text-danger">
                            Уволен
                        </span>
                    )}
                </span>
                {row.position && <span className="truncate font-ui text-xs text-ink-muted">{row.position}</span>}
            </span>

            <span className="flex shrink-0 flex-col items-end gap-0.5">
                <span
                    className={cn(
                        'font-ui text-base font-bold tabular-nums',
                        row.isNegative ? 'text-danger' : 'text-ink',
                    )}
                >
                    {row.balanceLabel}
                </span>
                <span className="font-ui text-xs text-ink-muted tabular-nums">{row.lastMovementLabel}</span>
            </span>

            <ChevronRight className="size-4 shrink-0 text-ink-faint" />
        </Link>
    )
}

export { EmployeeSettlementsCardList }
