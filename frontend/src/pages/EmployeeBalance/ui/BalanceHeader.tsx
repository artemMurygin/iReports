import { employeeInitials } from '@/features/SalaryAccruals'
import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'

export type BalanceHeaderProps = {
    employeeName: string
    /** «Отдел · Должность · связан с <ERP-системами>» — уже собранная строка (см.
     * `model/headerInfo.ts`'s `buildHeaderSubtitle`), `null` если сегментов нет вовсе. Не
     * `departmentName` напрямую (Фаза 5 docs/employee-settlements-page-redesign, Pencil
     * `L73YCK`/`JTc29`) — шапка больше не решает, что показывать, только рендерит готовую
     * строку (чистый медиатор, frontend/CLAUDE.md). */
    subtitle: string | null
    /** Общий остаток сотрудника (`EmployeeBalanceResponse.balance`) — не зависит от
     * фильтров ленты, одна цифра без деления на направления (Фаза 8b). */
    balance: number
    className?: string
}

/**
 * Pencil `L73YCK` (десктоп-руководитель) / `ps9b4` (десктоп-личный кабинет) / `lQM7O`,
 * `b6g6Z` (мобильные), правки Фазы 5: шапка — только имя/подпись/баланс, без кнопок
 * действий (вынесены в `BalanceActions`, отдельная строка под шапкой в дизайне) — баланс
 * ОБЩИЙ, без Direction Tabs и KPI-карточек по направлениям (Фаза 8b), одна крупная цифра
 * «Баланс» (отрицательный без предупреждений, просто `danger`-цветом).
 */
export function BalanceHeader({ employeeName, subtitle, balance, className }: BalanceHeaderProps) {
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
                    {subtitle !== null && <p className="truncate font-ui text-[13px] text-ink-muted">{subtitle}</p>}
                </div>
            </div>

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
        </div>
    )
}
