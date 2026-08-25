import { Search } from 'lucide-react'

import { PAYOUT_STATUS_FILTERS, PAYOUT_STATUS_FILTER_LABEL, type PayoutStatusFilter } from '@/features/Payout'
import { cn } from '@/shared/lib/tw'
import { Input } from '@/shared/ui-kit/atoms/Input'

export type PayoutFiltersProps = {
    value: PayoutStatusFilter
    onChange: (value: PayoutStatusFilter) => void
    counts: Record<PayoutStatusFilter, number>
    search: string
    onSearchChange: (search: string) => void
    className?: string
}

/** Pencil `OKluo`: чипы «Все / Только невыплаченные / Частично» + поиск по сотруднику справа —
 * тот же приём, что `AccrualStatusFilterRow` (features/SalaryAccruals). */
function PayoutFilters({ value, onChange, counts, search, onSearchChange, className }: PayoutFiltersProps) {
    return (
        <div
            data-slot="payout-filters"
            className={cn('flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between md:gap-4', className)}
        >
            <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
                {PAYOUT_STATUS_FILTERS.map((filter) => (
                    <button
                        key={filter}
                        type="button"
                        aria-pressed={value === filter}
                        onClick={() => onChange(filter)}
                        className={cn(
                            'shrink-0 rounded-full border px-3.5 py-[7px] font-ui text-[13px] font-medium whitespace-nowrap transition-colors select-none',
                            value === filter
                                ? 'border-ink bg-ink text-surface'
                                : 'border-hairline bg-surface text-ink hover:bg-canvas',
                        )}
                    >
                        {PAYOUT_STATUS_FILTER_LABEL[filter]} · {counts[filter]}
                    </button>
                ))}
            </div>

            <div className="relative md:w-[260px]">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-ink-faint" />
                <Input
                    type="search"
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Поиск по сотруднику"
                    aria-label="Поиск по сотруднику"
                    className="pl-9"
                />
            </div>
        </div>
    )
}

export { PayoutFilters }
