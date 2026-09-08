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
    /** `row.plan.id` -> selected. From `useSalesPlanSelection`. */
    selectedIds: Set<string>
    onToggleRow: (id: string) => void
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `T0FMcE` -> `LY6sB` (`List Header`) +
 * `WQjYG` (`Plan List`, one `i4Qz8y` `PlanCard` instance per category) — the mobile
 * counterpart of `SalesPlanTable`. `LY6sB` only contributes its counter text here ("N
 * категорий · Направление") — the "Select All" checkbox and the "По выполнению" sort control
 * next to it are not built: the task scoped "выбрать всё" to the desktop table header only
 * (`SalesPlanTable`'s `WWw3l`), not this list header. Each `PlanCard`'s own checkbox (`IRX80`,
 * inside its `Top` row) is implemented, though — see `PlanCard`.
 */
function SalesPlanCardList({ rows, direction, className, selectedIds, onToggleRow }: SalesPlanCardListProps) {
    return (
        <div data-slot="sales-plan-card-list" className={cn('flex flex-col gap-2.5', className)}>
            <span className="px-0.5 font-ui text-xs font-semibold text-ink">
                {rows.length} {pluralizeCategories(rows.length)} · {DIRECTION_LABEL[direction]}
            </span>

            <div className="flex flex-col gap-2.5">
                {rows.map((row) => (
                    <PlanCard
                        key={row.plan.id}
                        categoryName={row.categoryName}
                        orderTypesLabel={row.orderTypeNames.length > 0 ? row.orderTypeNames.join(', ') : undefined}
                        status={row.plan.status}
                        planLabel={formatNumber(row.plan.turnover)}
                        factLabel={formatNumber(row.fact.turnover)}
                        percentCompletion={row.fact.percentCompletion}
                        marginRangeLabel={`${formatNumber(row.fact.margin)} из ${formatNumber(row.plan.margin)}`}
                        marginPercent={row.marginPercent}
                        selected={selectedIds.has(row.plan.id)}
                        onSelectedChange={() => onToggleRow(row.plan.id)}
                    />
                ))}
            </div>
        </div>
    )
}

export { SalesPlanCardList }
