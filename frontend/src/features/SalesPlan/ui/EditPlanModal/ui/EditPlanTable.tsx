import type { OrderTypeResponse } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { ColumnHeader } from '@/shared/ui-kit/molecules/ColumnHeader'
import type { EditPlanSummary, EditRowView } from '@/features/SalesPlan/ui/EditPlanModal/model/useEditPlanForm.ts'
import { formatCurrency, formatPercent, pluralizeCategories } from '@/features/SalesPlan/model/format.ts'
import { EditPlanTableRow } from '@/features/SalesPlan/ui/EditPlanModal/ui/EditPlanTableRow.tsx'

const CATEGORY_WIDTH = 'min-w-[160px] flex-1'
const INPUT_WIDTH = 'w-[150px]'
const ORDER_TYPES_WIDTH = 'w-[170px]'
const FACT_WIDTH = 'w-[160px]'
const STATUS_WIDTH = 'w-[116px]'

type Props = {
    rowViews: EditRowView[]
    summary: EditPlanSummary
    onFieldChange: (planId: string, field: 'turnover' | 'margin', value: string) => void
    /** См. `EditPlanTableRow` — только `direction === 'service'` (RoApp), не для `shop`. */
    showOrderTypes: boolean
    orderTypes: OrderTypeResponse[]
    isOrderTypesLoading?: boolean
    onOrderTypeIdsChange: (planId: string, orderTypeIds: number[]) => void
}

/** `EditPlanModal`'s "Plan Editor Table" slot (Pencil: `wumav` → `O2SAV7`) — header row, one
 * `EditPlanTableRow` per category, and a totals row summing the current draft values. */
export function EditPlanTable({
    rowViews,
    summary,
    onFieldChange,
    showOrderTypes,
    orderTypes,
    isOrderTypesLoading,
    onOrderTypeIdsChange,
}: Props) {
    const factPercent = summary.draftTurnover !== 0 ? formatPercent(summary.factTurnover, summary.draftTurnover) : '0%'

    return (
        <div data-slot="edit-plan-table" className="overflow-hidden rounded-[10px] border border-hairline bg-surface">
            <div className="overflow-x-auto">
                <div className={showOrderTypes ? 'min-w-[890px]' : 'min-w-[720px]'}>
                    <div className="flex items-center border-b border-hairline bg-canvas">
                        <ColumnHeader label="Категория" className={CATEGORY_WIDTH} />
                        <ColumnHeader label="План выручки, ₽" align="end" className={INPUT_WIDTH} />
                        <ColumnHeader label="План маржи, ₽" align="end" className={INPUT_WIDTH} />
                        {showOrderTypes && <ColumnHeader label="Типы заказов" className={ORDER_TYPES_WIDTH} />}
                        <ColumnHeader label="Факт · выполнение" align="end" className={FACT_WIDTH} />
                        <ColumnHeader label="Статус" className={STATUS_WIDTH} />
                    </div>

                    {rowViews.map((view) => (
                        <EditPlanTableRow
                            key={view.row.plan.id}
                            view={view}
                            onFieldChange={(field, value) => onFieldChange(view.row.plan.id, field, value)}
                            showOrderTypes={showOrderTypes}
                            orderTypes={orderTypes}
                            isOrderTypesLoading={isOrderTypesLoading}
                            onOrderTypeIdsChange={(orderTypeIds) => onOrderTypeIdsChange(view.row.plan.id, orderTypeIds)}
                        />
                    ))}

                    <div className="flex h-11 items-center border-t border-hairline bg-canvas">
                        <span className={cn('truncate px-3 font-ui text-xs font-semibold text-ink', CATEGORY_WIDTH)}>
                            Итого · {summary.categoriesCount} {pluralizeCategories(summary.categoriesCount)}
                        </span>
                        <span className={cn('shrink-0 truncate px-3 text-right font-ui text-xs font-semibold text-ink', INPUT_WIDTH)}>
                            {formatCurrency(summary.draftTurnover)}
                        </span>
                        <span className={cn('shrink-0 truncate px-3 text-right font-ui text-xs font-semibold text-ink', INPUT_WIDTH)}>
                            {formatCurrency(summary.draftMargin)}
                        </span>
                        {showOrderTypes && <span className={cn('shrink-0', ORDER_TYPES_WIDTH)} />}
                        <span className={cn('shrink-0 truncate px-3 text-right font-ui text-xs font-semibold text-ink', FACT_WIDTH)}>
                            {formatCurrency(summary.factTurnover)} · {factPercent}
                        </span>
                        <span className={cn('shrink-0', STATUS_WIDTH)} />
                    </div>
                </div>
            </div>
        </div>
    )
}
