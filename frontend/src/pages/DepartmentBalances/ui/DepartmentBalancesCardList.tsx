import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { DepartmentEmployeeBalance } from 'ireports-contracts'

import { AccrualStatusBadge, employeeInitials } from '@/features/SalaryAccruals'
import { formatNumber, formatSignedCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'

export type DepartmentBalancesCardListProps = {
    employees: DepartmentEmployeeBalance[]
    className?: string
}

/**
 * Pencil `iEYMb` (`Баланс · Отдел`, мобильный): карточка сотрудника — аватар + ФИО + «Остаток»
 * крупно справа, ниже строка «Начислено / Авансы / Ручные» в три колонки, статус-бейдж и
 * ссылка «Открыть баланс» снизу. Тот же приём переключения по брейкпоинту (`md:hidden` /
 * `hidden md:block`), что `AccrualCardList`/`AccrualsTable` в `pages/SalaryAccruals`.
 */
function DepartmentBalancesCardList({ employees, className }: DepartmentBalancesCardListProps) {
    if (employees.length === 0) {
        return (
            <div data-slot="department-balances-card-list" className={cn('rounded-xl border border-hairline bg-surface p-4 text-center', className)}>
                <p className="font-ui text-xs text-ink-muted">У сотрудников отдела нет движений за выбранный период.</p>
            </div>
        )
    }

    return (
        <div data-slot="department-balances-card-list" className={cn('flex flex-col gap-2.5', className)}>
            {employees.map((employee) => (
                <DepartmentBalanceCard key={employee.employeeId} employee={employee} />
            ))}
        </div>
    )
}

function DepartmentBalanceCard({ employee }: { employee: DepartmentEmployeeBalance }) {
    return (
        <Link
            to={`/balance/employee/${employee.employeeId}`}
            data-slot="department-balance-card"
            className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-3.5 font-ui transition-colors hover:bg-canvas"
        >
            <span className="flex items-center gap-2.5">
                <Avatar>
                    <AvatarFallback>{employeeInitials(employee.employeeName)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{employee.employeeName}</span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-[11px] text-ink-muted">Остаток</span>
                    <span
                        className={cn(
                            'font-display text-lg font-bold tracking-[-0.3px]',
                            employee.balance < 0 ? 'text-danger' : 'text-ink',
                        )}
                    >
                        {formatNumber(employee.balance)} ₽
                    </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-faint" />
            </span>

            <span className="grid grid-cols-3 gap-2 border-t border-hairline pt-2.5">
                <span className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-ink-muted">Начислено</span>
                    <span className="text-[13px] font-semibold text-ink tabular-nums">{formatNumber(employee.accrued)}</span>
                </span>
                <span className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-ink-muted">Авансы</span>
                    <span className="text-[13px] font-semibold text-ink-muted tabular-nums">
                        {employee.advances === 0 ? '—' : formatNumber(employee.advances)}
                    </span>
                </span>
                <span className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-ink-muted">Ручные</span>
                    <span
                        className={cn(
                            'text-[13px] font-semibold tabular-nums',
                            employee.manual > 0 ? 'text-ok-ink' : employee.manual < 0 ? 'text-danger' : 'text-ink-faint',
                        )}
                    >
                        {employee.manual === 0 ? '—' : formatSignedCurrency(employee.manual)}
                    </span>
                </span>
            </span>

            <span className="flex items-center justify-between gap-2">
                {employee.accrualStatus !== null ? (
                    <AccrualStatusBadge status={employee.accrualStatus} />
                ) : (
                    <span className="font-ui text-xs text-ink-faint">Начислений нет</span>
                )}
                <span className="font-ui text-xs font-semibold text-brand-strong">Открыть баланс</span>
            </span>
        </Link>
    )
}

export { DepartmentBalancesCardList }
