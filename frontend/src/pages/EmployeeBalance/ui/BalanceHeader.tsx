import { Banknote, Minus, Plus } from 'lucide-react'

import { employeeInitials } from '@/features/SalaryAccruals'
import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'
import { Button } from '@/shared/ui-kit/atoms/Button'

export type BalanceHeaderProps = {
    employeeName: string
    departmentName: string | null
    /** Общий остаток сотрудника (`EmployeeBalanceResponse.balance`) — не зависит от
     * фильтров ленты, одна цифра без деления на направления (Фаза 8b). */
    balance: number
    onAddIncome: () => void
    onAddOutcome: () => void
    /** Открывает `PayoutDrawer` (features/Payout, Фаза 14 docs/payroll-closing-and-accrual) —
     * та же форма выплаты, что на странице «Выплата», доступна прямо со строки баланса. */
    onPay: () => void
    /** Личный кабинет сотрудника (будущий readOnly-маршрут) скрывает все три кнопки. */
    readOnly?: boolean
    className?: string
}

/**
 * Pencil `L73YCK` (десктоп-руководитель) / `ps9b4` (десктоп-личный кабинет) / `lQM7O`,
 * `b6g6Z` (мобильные) — правки Фазы 8b: баланс ОБЩИЙ, без Direction Tabs и KPI-карточек
 * по направлениям — одна крупная цифра «Баланс» (отрицательный без предупреждений,
 * просто `danger`-цветом). Кнопки «Добавить приход»/«Добавить расход» открывают
 * `NewTransactionDrawer` с предвыбранным направлением и скрыты в личном кабинете
 * (`readOnly`).
 */
export function BalanceHeader({
    employeeName,
    departmentName,
    balance,
    onAddIncome,
    onAddOutcome,
    onPay,
    readOnly = false,
    className,
}: BalanceHeaderProps) {
    return (
        <div
            data-slot="employee-balance-header"
            className={cn(
                'flex flex-col gap-4 rounded-xl border border-hairline bg-surface p-4 md:flex-row md:items-center md:justify-between md:rounded-none md:border-0 md:bg-transparent md:p-0',
                className,
            )}
        >
            <div className="flex items-center gap-3.5">
                <Avatar size="lg">
                    <AvatarFallback>{employeeInitials(employeeName)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col gap-1">
                    <h1 className="truncate font-display text-[22px] font-bold tracking-[-0.4px] text-ink md:text-[26px]">
                        {employeeName}
                    </h1>
                    {departmentName !== null && (
                        <p className="truncate font-ui text-[13px] text-ink-muted">{departmentName}</p>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 md:justify-end">
                <div className="flex min-w-0 flex-col gap-0.5 md:items-end">
                    <span className="font-ui text-[13px] text-ink-muted">Баланс</span>
                    <span
                        className={cn(
                            'font-display text-[26px] font-bold tracking-[-0.5px] tabular-nums md:text-[30px]',
                            balance < 0 ? 'text-danger' : 'text-ink',
                        )}
                    >
                        {formatCurrency(balance)}
                    </span>
                </div>

                {!readOnly && (
                    <div className="flex shrink-0 items-center gap-2">
                        <Button type="button" variant="secondary" onClick={onAddIncome}>
                            <Plus />
                            Добавить приход
                        </Button>
                        <Button type="button" variant="secondary" onClick={onAddOutcome}>
                            <Minus />
                            Добавить расход
                        </Button>
                        <Button type="button" onClick={onPay}>
                            <Banknote />
                            Выплатить
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
