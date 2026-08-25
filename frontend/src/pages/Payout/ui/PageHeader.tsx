import { Landmark } from 'lucide-react'
import type { SalesDirection } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { PeriodPicker } from '@/features/SalesPlan'

const DIRECTIONS: { value: SalesDirection; label: string }[] = [
    { value: 'service', label: 'Сервис' },
    { value: 'shop', label: 'Магазин' },
]

export type PageHeaderProps = {
    direction: SalesDirection
    onDirectionChange: (direction: SalesDirection) => void
    period: string
    onPeriodChange: (period: string) => void
    /** «RemOnline · касса Основная» / «МойСклад · статья «Зарплата»» — read-only, без выбора
     * (P3.1, Фаза 14). */
    cashLabel: string
    className?: string
}

/**
 * Pencil `OKluo` (`Выплата · Месяц`, десктоп) / `R6Ybh` (мобильный) — заголовок «Выплата
 * зарплаты», Direction Tabs (тот же приём, что `pages/SalaryAccruals/ui/PageHeader`),
 * Period Chip и подпись кассы направления справа от него.
 */
function PageHeader({ direction, onDirectionChange, period, onPeriodChange, cashLabel, className }: PageHeaderProps) {
    return (
        <div data-slot="payout-page-header" className={cn('flex flex-col gap-4', className)}>
            <div className="flex flex-col gap-1">
                <h1 className="font-display text-[26px] font-bold tracking-[-0.4px] text-ink">Выплата зарплаты</h1>
                <p className="font-ui text-sm text-ink-muted">
                    Выплата создаёт документ в кассе ERP и движение на балансе сотрудника
                </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-1 rounded-[10px] bg-hairline p-1" role="tablist" aria-label="Направление">
                    {DIRECTIONS.map(({ value, label }) => (
                        <button
                            key={value}
                            type="button"
                            role="tab"
                            aria-selected={direction === value}
                            onClick={() => onDirectionChange(value)}
                            className={cn(
                                'rounded-lg px-3 py-1.5 font-ui text-[13px] transition-colors select-none',
                                direction === value
                                    ? 'bg-surface font-semibold text-ink shadow-sm'
                                    : 'font-medium text-ink-muted hover:text-ink',
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <PeriodPicker period={period} onPeriodChange={onPeriodChange} />
                    <div className="flex items-center gap-2 rounded-lg border border-hairline bg-canvas px-3 py-[7px]">
                        <Landmark className="size-3.5 shrink-0 text-ink-muted" />
                        <span className="font-ui text-[13px] font-medium text-ink-muted">Касса: {cashLabel}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export { PageHeader }
