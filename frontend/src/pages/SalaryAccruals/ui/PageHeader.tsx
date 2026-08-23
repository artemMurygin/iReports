import { Wallet } from 'lucide-react'
import type { SalesDirection } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'
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
    isPeriodClosed: boolean
    /** «Иван Петров · 01.08.2026 14:20» — готовая подпись закрытия (null, пока грузится справочник). */
    closedLabel: string | null
    /** Не-`PAID` документов в текущем списке — кнопка «Начислить все документы месяца»
     * видна только пока их больше нуля (Фаза 9). */
    nonPaidCount: number
    onAccrueAllMonth: () => void
    className?: string
}

/**
 * Pencil `cfNlL` (`Начисления · Список`) / `Q0i6z3` (мобильный): заголовок «Начисления
 * зарплаты», пилюля статуса периода (та же, что у плана продаж: «Период закрыт · Иван
 * Петров · 01.08.2026 14:20» / «Период открыт»), Direction Tabs, Period Chip и (Фаза 9,
 * `yDI1H`) кнопка «Начислить все документы месяца» — видна, только пока в текущем
 * списке есть хотя бы один не-`PAID` документ (пустой список/все выплачены -> скрыта).
 */
function PageHeader({
    direction,
    onDirectionChange,
    period,
    onPeriodChange,
    isPeriodClosed,
    closedLabel,
    nonPaidCount,
    onAccrueAllMonth,
    className,
}: PageHeaderProps) {
    const subtitle = isPeriodClosed
        ? 'Документ начисления создаётся на каждого сотрудника снапшота при закрытии месяца'
        : 'Документы начисления появляются после закрытия месяца'

    return (
        <div data-slot="salary-accruals-page-header" className={cn('flex flex-col gap-4', className)}>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="font-display text-[26px] font-bold tracking-[-0.4px] text-ink">
                        Начисления зарплаты
                    </h1>
                    <p className="font-ui text-sm text-ink-muted">{subtitle}</p>
                </div>

                {isPeriodClosed ? (
                    <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-info-soft px-3 py-[7px]">
                        <span className="size-[7px] rounded-full bg-info-ink" />
                        <span className="font-ui text-[13px] font-medium text-info-ink">
                            Период закрыт{closedLabel !== null ? ` · ${closedLabel}` : ''}
                        </span>
                    </div>
                ) : (
                    <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-soft px-3 py-[7px]">
                        <span className="size-[7px] rounded-full bg-brand-strong" />
                        <span className="font-ui text-[13px] font-medium text-ok-ink">Период открыт</span>
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div
                    className="flex items-center gap-1 rounded-[10px] bg-hairline p-1"
                    role="tablist"
                    aria-label="Направление"
                >
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
                    <PeriodPicker period={period} onPeriodChange={onPeriodChange} isClosed={isPeriodClosed} />
                    {nonPaidCount > 0 && (
                        <Button type="button" variant="secondary" onClick={onAccrueAllMonth}>
                            <Wallet />
                            Начислить все документы месяца
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

export { PageHeader }
