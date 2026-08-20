import type { SalesDirection } from 'ireports-contracts'

import { Modal } from '@/shared/ui-kit/organisms/Modal'
import type { SalesPlanRow } from '@/features/SalesPlan/model/useSalesPlan.ts'
import { formatPeriodLabel } from '@/features/SalesPlan/model/format.ts'
import { useEditPlanForm } from '@/features/SalesPlan/ui/EditPlanModal/model/useEditPlanForm.ts'
import { EditPlanModalBody } from '@/features/SalesPlan/ui/EditPlanModal/ui/EditPlanModalBody.tsx'
import { EditPlanModalFooter } from '@/features/SalesPlan/ui/EditPlanModal/ui/EditPlanModalFooter.tsx'

const DIRECTION_LABEL: Record<SalesDirection, string> = {
    service: 'Сервис',
    shop: 'Магазин',
}

export type EditPlanModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    direction: SalesDirection
    period: string
    /** Already resolved by the caller to the effective edit set — selected rows if the page's
     * selection (`useSalesPlanSelection`) is non-empty, otherwise every row currently visible.
     * See `SalesPlanPage`. */
    rows: SalesPlanRow[]
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `wumav` (`Dialog · Редактирование плана`) —
 * the filled-in instance of the base `XttYX` (`ERP/Organism/Modal`) component: `Modal`'s own
 * title/subtitle/footer slots supply the header copy and "Отмена"/"Сохранить план" actions, and
 * `wumav`'s body (`uV9xp`) is a "Plan Summary" card (`EditPlanSummary`) above a "Plan Editor
 * Table" (`EditPlanTable`) — a wider dialog than `Modal`'s 480px default (`className` below,
 * ~820px in the design) to fit the table's five columns.
 *
 * Opened from `PageHeader`'s "Изменить план" button (`JjkSX`/`e1D3nB`). `rows` is always the
 * already-resolved edit set (selection-or-all — see the prop doc); this component only renders
 * inputs and diffs them against each row's current `plan.turnover`/`plan.margin`, it doesn't
 * know about `useSalesPlanSelection` at all.
 *
 * Purely presentational — editable-state, validation, the summary/per-row derived numbers and
 * the save mutation live in `useEditPlanForm`; the body and footer slots are their own
 * components (`EditPlanModalBody`, `EditPlanModalFooter`, see `frontend/CLAUDE.md`'s "Слоты
 * вместо children"), assembled here as props rather than inlined into `Modal`'s JSX.
 */
function EditPlanModal({ open, onOpenChange, direction, period, rows }: EditPlanModalProps) {
    const { rowViews, summary, setField, canSave, isSaving, handleCancel, handleSave } = useEditPlanForm({
        open,
        onOpenChange,
        direction,
        rows,
    })

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            className="sm:max-w-[860px]"
            title="Редактирование плана продаж"
            subtitle={`Направление «${DIRECTION_LABEL[direction]}» · ${formatPeriodLabel(period)} · период открыт`}
            footer={(
                <EditPlanModalFooter
                    onCancel={handleCancel}
                    onSave={handleSave}
                    canSave={canSave}
                    isSaving={isSaving}
                />)}
        >
            <EditPlanModalBody
                rowViews={rowViews}
                summary={summary}
                onFieldChange={setField}
            />
        </Modal>
    )
}

export { EditPlanModal }
