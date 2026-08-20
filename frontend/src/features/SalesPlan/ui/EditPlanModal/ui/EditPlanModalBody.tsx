import type { EditPlanSummary as EditPlanSummaryData, EditRowView, FieldValues } from '@/features/SalesPlan/ui/EditPlanModal/model/useEditPlanForm.ts'
import { EditPlanSummary } from '@/features/SalesPlan/ui/EditPlanModal/ui/EditPlanSummary.tsx'
import { EditPlanTable } from '@/features/SalesPlan/ui/EditPlanModal/ui/EditPlanTable.tsx'

type Props = {
    rowViews: EditRowView[]
    summary: EditPlanSummaryData
    onFieldChange: (planId: string, field: keyof FieldValues, value: string) => void
}

/** `EditPlanModal`'s body slot: the plan summary card + editor table, or the "нет категорий"
 * placeholder. */
export function EditPlanModalBody({ rowViews, summary, onFieldChange }: Props) {
    if (rowViews.length === 0) {
        return <p className="font-ui text-sm text-ink-muted">Нет категорий для редактирования.</p>
    }

    return (
        <div className="flex flex-col gap-4">
            <EditPlanSummary summary={summary} />
            <EditPlanTable rowViews={rowViews} summary={summary} onFieldChange={onFieldChange} />
        </div>
    )
}
