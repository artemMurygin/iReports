import type { BalanceTransactionType } from 'ireports-contracts'

import { transactionTypeLabel } from '@/features/EmployeeBalance'
import { PeriodPicker } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

const ALL_TYPES = Object.keys(transactionTypeLabel) as BalanceTransactionType[]

export type BalanceFiltersProps = {
    period: string
    onPeriodChange: (period: string) => void
    selectedTypes: readonly BalanceTransactionType[]
    onToggleType: (type: BalanceTransactionType) => void
    onClearTypes: () => void
    className?: string
}

/**
 * Фильтры ленты (Фаза 10 docs/payroll-closing-and-accrual): месяц — тот же Period Chip
 * (`PeriodPicker`), что и в остальных страницах фичи начислений; типы — мультиселект
 * toggle-чипами (та же геометрия пилюль, что `AccrualStatusFilterRow`, только без
 * взаимоисключения — несколько типов можно выбрать одновременно). MVP: без индикатора
 * количества движений на чип (в отличие от статус-фильтра начислений, у ленты баланса
 * нет готового счётчика по типу без похода за отдельным запросом).
 */
export function BalanceFilters({
    period,
    onPeriodChange,
    selectedTypes,
    onToggleType,
    onClearTypes,
    className,
}: BalanceFiltersProps) {
    return (
        <div
            data-slot="employee-balance-filters"
            className={cn('flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between md:gap-4', className)}
        >
            <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
                <button
                    type="button"
                    aria-pressed={selectedTypes.length === 0}
                    onClick={onClearTypes}
                    className={cn(
                        'shrink-0 rounded-full border px-3.5 py-[7px] font-ui text-[13px] font-medium whitespace-nowrap transition-colors select-none',
                        selectedTypes.length === 0
                            ? 'border-ink bg-ink text-surface'
                            : 'border-hairline bg-surface text-ink hover:bg-canvas',
                    )}
                >
                    Все типы
                </button>
                {ALL_TYPES.map((type) => {
                    const active = selectedTypes.includes(type)
                    return (
                        <button
                            key={type}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onToggleType(type)}
                            className={cn(
                                'shrink-0 rounded-full border px-3.5 py-[7px] font-ui text-[13px] font-medium whitespace-nowrap transition-colors select-none',
                                active
                                    ? 'border-ink bg-ink text-surface'
                                    : 'border-hairline bg-surface text-ink hover:bg-canvas',
                            )}
                        >
                            {transactionTypeLabel[type]}
                        </button>
                    )
                })}
            </div>

            <PeriodPicker period={period} onPeriodChange={onPeriodChange} />
        </div>
    )
}
