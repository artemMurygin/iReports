import type { OrderTypeResponse } from 'ireports-contracts'

import type { EditPlanSummary as EditPlanSummaryData, EditRowView } from '@/features/SalesPlan/ui/EditPlanModal/model/useEditPlanForm.ts'
import { EditPlanSummary } from '@/features/SalesPlan/ui/EditPlanModal/ui/EditPlanSummary.tsx'
import { EditPlanTable } from '@/features/SalesPlan/ui/EditPlanModal/ui/EditPlanTable.tsx'

type Props = {
    rowViews: EditRowView[]
    summary: EditPlanSummaryData
    onFieldChange: (planId: string, field: 'turnover' | 'margin', value: string) => void
    showOrderTypes: boolean
    orderTypes: OrderTypeResponse[]
    isOrderTypesLoading?: boolean
    onOrderTypeIdsChange: (planId: string, orderTypeIds: number[]) => void
}

/** `EditPlanModal`'s body slot: the plan summary card + editor table, or the "нет категорий"
 * placeholder. */
export function EditPlanModalBody({
    rowViews,
    summary,
    onFieldChange,
    showOrderTypes,
    orderTypes,
    isOrderTypesLoading,
    onOrderTypeIdsChange,
}: Props) {
    if (rowViews.length === 0) {
        return <p className="font-ui text-sm text-ink-muted">Нет категорий для редактирования.</p>
    }

    return (
        <div className="flex flex-col gap-4">
            <EditPlanSummary summary={summary} />
            <EditPlanTable
                rowViews={rowViews}
                summary={summary}
                onFieldChange={onFieldChange}
                showOrderTypes={showOrderTypes}
                orderTypes={orderTypes}
                isOrderTypesLoading={isOrderTypesLoading}
                onOrderTypeIdsChange={onOrderTypeIdsChange}
            />
        </div>
    )
}
