import type { SalesDirection } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { PlanCard } from '@/shared/ui-kit/molecules/PlanCard'
import type { SalesPlanRow } from '@/features/SalesPlan/model/useSalesPlan.ts'
import { formatNumber, pluralizeCategories } from '@/features/SalesPlan/model/format.ts'

const DIRECTION_LABEL: Record<SalesDirection, string> = {
    service: 'Сервис',
    shop: 'Магазин',
}

export type SalesPlanCardListProps = {
    rows: SalesPlanRow[]
    direction: SalesDirection
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `T0FMcE` -> `LY6sB` (`List Header`) +
 * `WQjYG` (`Plan List`, one `i4Qz8y` `PlanCard` instance per category) — the mobile
 * counterpart of `SalesPlanTable`. `LY6sB` only contributes its counter text here ("N
 * категорий · Направление") — the "Select All" checkbox and the "По выполнению" sort control
 * next to it are the same out-of-scope mutation/interaction affordances `SalesPlanTable`
 * already drops (see Фаза 2 of docs/sales-plan-view-page/plan-sales-plan-view-page.md); this
 * page is view-only.
 */
function SalesPlanCardList({ rows, direction, className }: SalesPlanCardListProps) {
    return (
        <div data-slot="sales-plan-card-list" className={cn('flex flex-col gap-2.5', className)}>
            <span className="px-0.5 font-ui text-xs font-semibold text-ink">
                {rows.length} {pluralizeCategories(rows.length)} · {DIRECTION_LABEL[direction]}
            </span>

            <div className="flex flex-col gap-2.5">
                {rows.map((row) => (
                    <PlanCard
                        key={`${row.direction}-${row.department}-${row.category ?? 'null'}`}
                        categoryName={row.categoryName}
                        status={row.plan.status}
                        planLabel={formatNumber(row.plan.turnover)}
                        factLabel={formatNumber(row.fact.turnover)}
                        percentCompletion={row.fact.percentCompletion}
                        marginRangeLabel={`${formatNumber(row.fact.margin)} из ${formatNumber(row.plan.margin)}`}
                        marginPercent={row.marginPercent}
                    />
                ))}
            </div>
        </div>
    )
}

export { SalesPlanCardList }
