import { Link } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import type { DepartmentBalancesTotals, DepartmentEmployeeBalance } from 'ireports-contracts'

import { AccrualStatusBadge, employeeInitials } from '@/features/SalaryAccruals'
import { formatNumber, formatSignedCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { ColumnHeader } from '@/shared/ui-kit/molecules/ColumnHeader'

const COLUMN_WIDTH = {
    balance: 'w-[130px]',
    accrued: 'w-[120px]',
    advances: 'w-[120px]',
    manual: 'w-[120px]',
    status: 'w-[170px]',
    action: 'w-[168px]',
}

export type DepartmentBalancesTableProps = {
    employees: DepartmentEmployeeBalance[]
    totals: DepartmentBalancesTotals
    className?: string
}

/**
 * Pencil `IFJW2` (`Баланс · Отдел`, десктопная таблица): Сотрудник (аватар-инициалы + ФИО) ·
 * Остаток, ₽ · Начислено · Авансы · Ручные · Статус начисления · Действие («Открыть баланс»,
 * ссылка на `/balance/employee/:id` — карточку из этой же Фазы 10). Итоговая строка внизу —
 * `totals` ответа `getDepartmentBalances` (инвариант «итог — сумма строк» проверен бэкенд-
 * тестом, см. `contracts/commands/employee-balance.ts`).
 *
 * Колонка «Остаток» — ОДНО число (`employee.balance`), без разбивки по направлениям (Фаза
 * 8b: баланс общий по сотруднику) — в отличие от `AccrualsTable`, где колонки сгруппированы
 * по документу одного направления.
 *
 * Ответ `getDepartmentBalances` не несёт должности сотрудника (только `employeeId`/
 * `employeeName`) — в отличие от `AccrualsTable`'s "Отдел" под именем, здесь под ФИО ничего
 * не выводится, показывать нечего.
 */
function DepartmentBalancesTable({ employees, totals, className }: DepartmentBalancesTableProps) {
    return (
        <div
            data-slot="department-balances-table"
            className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}
        >
            <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                    <div className="flex items-center border-b border-hairline bg-canvas">
                        <ColumnHeader label="Сотрудник" className="min-w-[220px] flex-1" />
                        <ColumnHeader label="Остаток, ₽" align="end" emphasis className={COLUMN_WIDTH.balance} />
                        <ColumnHeader label="Начислено" align="end" className={COLUMN_WIDTH.accrued} />
                        <ColumnHeader label="Авансы" align="end" className={COLUMN_WIDTH.advances} />
                        <ColumnHeader label="Ручные" align="end" className={COLUMN_WIDTH.manual} />
                        <ColumnHeader label="Статус начисления" className={COLUMN_WIDTH.status} />
                        <ColumnHeader label="" className={COLUMN_WIDTH.action} />
                    </div>

                    {employees.length === 0 ? (
                        <p className="px-4 py-8 text-center font-ui text-xs text-ink-muted">
                            У сотрудников отдела нет движений за выбранный период.
                        </p>
                    ) : (
                        employees.map((employee) => <DepartmentBalancesTableRow key={employee.employeeId} employee={employee} />)
                    )}

                    <div className={cn('flex items-center border-t border-hairline bg-canvas', employees.length === 0 && 'border-t-0')}>
                        <div className="flex min-w-[220px] flex-1 items-center px-3 py-3">
                            <span className="font-ui text-[13px] font-semibold text-ink">
                                Итого по отделу · {employees.length} сотрудников
                            </span>
                        </div>
                        <span
                            className={cn(
                                'shrink-0 px-3 text-right font-ui text-sm font-bold tabular-nums',
                                totals.balance < 0 ? 'text-danger' : 'text-ink',
                                COLUMN_WIDTH.balance,
                            )}
                        >
                            {formatNumber(totals.balance)}
                        </span>
                        <span className={cn('shrink-0 px-3 text-right font-ui text-sm font-bold text-ink tabular-nums', COLUMN_WIDTH.accrued)}>
                            {formatNumber(totals.accrued)}
                        </span>
                        <span className={cn('shrink-0 px-3 text-right font-ui text-sm font-semibold text-ink-muted tabular-nums', COLUMN_WIDTH.advances)}>
                            {formatNumber(totals.advances)}
                        </span>
                        <span
                            className={cn(
                                'shrink-0 px-3 text-right font-ui text-sm font-semibold tabular-nums',
                                totals.manual > 0 ? 'text-ok-ink' : totals.manual < 0 ? 'text-danger' : 'text-ink-faint',
                                COLUMN_WIDTH.manual,
                            )}
                        >
                            {totals.manual === 0 ? '—' : formatSignedCurrency(totals.manual)}
                        </span>
                        <div className={COLUMN_WIDTH.status} />
                        <div className={COLUMN_WIDTH.action} />
                    </div>
                </div>
            </div>
        </div>
    )
}

function DepartmentBalancesTableRow({ employee }: { employee: DepartmentEmployeeBalance }) {
    return (
        <div
            data-slot="department-balances-table-row"
            className="flex items-center border-b border-hairline transition-colors last:border-b-0 hover:bg-canvas"
        >
            <div className="flex min-w-[220px] flex-1 items-center gap-3 px-3 py-2.5">
                <Avatar>
                    <AvatarFallback>{employeeInitials(employee.employeeName)}</AvatarFallback>
                </Avatar>
                <span className="truncate font-ui text-sm font-semibold text-ink">{employee.employeeName}</span>
            </div>

            <span
                className={cn(
                    'shrink-0 px-3 text-right font-ui text-sm font-bold tabular-nums',
                    employee.balance < 0 ? 'text-danger' : 'text-ink',
                    COLUMN_WIDTH.balance,
                )}
            >
                {formatNumber(employee.balance)}
            </span>
            <span className={cn('shrink-0 px-3 text-right font-ui text-sm text-ink tabular-nums', COLUMN_WIDTH.accrued)}>
                {formatNumber(employee.accrued)}
            </span>
            <span className={cn('shrink-0 px-3 text-right font-ui text-sm text-ink-muted tabular-nums', COLUMN_WIDTH.advances)}>
                {employee.advances === 0 ? '—' : formatNumber(employee.advances)}
            </span>
            <span
                className={cn(
                    'shrink-0 px-3 text-right font-ui text-sm font-semibold tabular-nums',
                    employee.manual > 0 ? 'text-ok-ink' : employee.manual < 0 ? 'text-danger' : 'text-ink-faint',
                    COLUMN_WIDTH.manual,
                )}
            >
                {employee.manual === 0 ? '—' : formatSignedCurrency(employee.manual)}
            </span>

            <div className={cn('shrink-0 px-3', COLUMN_WIDTH.status)}>
                {employee.accrualStatus !== null ? (
                    <AccrualStatusBadge status={employee.accrualStatus} />
                ) : (
                    <span className="font-ui text-xs text-ink-faint">—</span>
                )}
            </div>

            <div className={cn('flex shrink-0 items-center px-3 py-2', COLUMN_WIDTH.action)}>
                <Button type="button" variant="secondary" size="sm" asChild>
                    <Link to={`/balance/employee/${employee.employeeId}`}>
                        <Wallet />
                        Открыть баланс
                    </Link>
                </Button>
            </div>
        </div>
    )
}

export { DepartmentBalancesTable }
