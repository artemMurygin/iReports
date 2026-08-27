import { Link } from 'react-router-dom'
import type { BalanceSummaryEmployee, BalanceSummaryTotals } from 'ireports-contracts'

import { pluralizeEmployees } from '@/features/SalaryReportData'
import { formatCurrency } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'
import { ColumnHeader } from '@/shared/ui-kit/molecules/ColumnHeader'

import { buildEmployeeRowVM } from '../model/employeeRow.ts'

const COLUMN_WIDTH = {
    department: 'w-[180px]',
    lastMovement: 'w-[170px]',
    balance: 'w-[150px]',
}

export type EmployeeSettlementsTableProps = {
    employees: BalanceSummaryEmployee[]
    totals: BalanceSummaryTotals
    className?: string
}

/**
 * Pencil `IFJW2` (десктопная таблица «Взаиморасчёты с сотрудниками»): Сотрудник (аватар-
 * инициалы + ФИО + должность) · Отдел · Последнее движение · Остаток, ₽. Вся строка —
 * ссылка на `/balance/employee/:id` (PRD: «Клик по строке ведёт на страницу баланса
 * сотрудника») — в отличие от `DepartmentBalancesTable`'s отдельной кнопки «Открыть баланс»
 * в своей колонке, здесь колонки действия нет вовсе, поведение как у `SchemaCard`-подобных
 * кликабельных строк.
 *
 * Плоская таблица без группировки по отделам даже в режиме «Все отделы» — намеренно (PRD:
 * "для десктопной раскладки — плоская таблица с колонкой «Отдел», группировка не
 * обязательна"); группировка с подытогами — только мобильная раскладка, Фаза 4.
 */
function EmployeeSettlementsTable({ employees, totals, className }: EmployeeSettlementsTableProps) {
    return (
        <div
            data-slot="employee-settlements-table"
            className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}
        >
            <div className="overflow-x-auto">
                <div className="min-w-[820px]">
                    <div className="flex items-center border-b border-hairline bg-canvas">
                        <ColumnHeader label="Сотрудник" className="min-w-[240px] flex-1" />
                        <ColumnHeader label="Отдел" className={COLUMN_WIDTH.department} />
                        <ColumnHeader label="Последнее движение" className={COLUMN_WIDTH.lastMovement} />
                        <ColumnHeader label="Остаток, ₽" align="end" emphasis className={COLUMN_WIDTH.balance} />
                    </div>

                    {employees.length === 0 ? (
                        <p className="px-4 py-8 text-center font-ui text-xs text-ink-muted">
                            Нет сотрудников по текущим условиям — измените отдел или поиск.
                        </p>
                    ) : (
                        employees.map((employee) => <EmployeeSettlementsTableRow key={employee.employeeId} employee={employee} />)
                    )}

                    <div className={cn('flex items-center border-t border-hairline bg-canvas', employees.length === 0 && 'border-t-0')}>
                        <div className="flex min-w-[240px] flex-1 items-center px-3 py-3">
                            <span className="font-ui text-[13px] font-semibold text-ink">
                                Итого · {pluralizeEmployees(employees.length)}
                            </span>
                        </div>
                        <div className={COLUMN_WIDTH.department} />
                        <div className={COLUMN_WIDTH.lastMovement} />
                        <span
                            className={cn(
                                'shrink-0 px-3 text-right font-ui text-sm font-bold tabular-nums',
                                totals.balance < 0 ? 'text-danger' : 'text-ink',
                                COLUMN_WIDTH.balance,
                            )}
                        >
                            {formatCurrency(totals.balance)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function EmployeeSettlementsTableRow({ employee }: { employee: BalanceSummaryEmployee }) {
    const row = buildEmployeeRowVM(employee)

    return (
        <Link
            to={`/balance/employee/${row.employeeId}`}
            data-slot="employee-settlements-table-row"
            className="flex items-center border-b border-hairline transition-colors last:border-b-0 hover:bg-canvas"
        >
            <div className="flex min-w-[240px] flex-1 items-center gap-3 px-3 py-2.5">
                <Avatar>
                    <AvatarFallback>{row.initials}</AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col">
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
            </div>

            <span className={cn('shrink-0 truncate px-3 font-ui text-sm text-ink-muted', COLUMN_WIDTH.department)}>
                {row.departmentName}
            </span>

            <span className={cn('shrink-0 px-3 font-ui text-sm text-ink-muted tabular-nums', COLUMN_WIDTH.lastMovement)}>
                {row.lastMovementLabel}
            </span>

            <span
                className={cn(
                    'shrink-0 px-3 text-right font-ui text-sm font-bold tabular-nums',
                    row.isNegative ? 'text-danger' : 'text-ink',
                    COLUMN_WIDTH.balance,
                )}
            >
                {row.balanceLabel}
            </span>
        </Link>
    )
}

export { EmployeeSettlementsTable }
