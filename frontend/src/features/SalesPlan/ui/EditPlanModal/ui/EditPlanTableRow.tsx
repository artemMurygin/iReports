import type { CSSProperties } from 'react'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import type { OrderTypeResponse } from 'ireports-contracts'
import { GripVertical } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { CellStatus } from '@/shared/ui-kit/molecules/CellStatus'
import type { EditRowView } from '@/features/SalesPlan/ui/EditPlanModal/model/useEditPlanForm.ts'
import { formatCurrency, formatPercent } from '@/features/SalesPlan/model/format.ts'
import { OrderTypeSelect } from '@/features/SalesPlan/ui/EditPlanModal/ui/OrderTypeSelect.tsx'

export const HANDLE_WIDTH = 'w-8'
const CATEGORY_WIDTH = 'min-w-[160px] flex-1'
const INPUT_WIDTH = 'w-[150px]'
const ORDER_TYPES_WIDTH = 'w-[170px]'
const FACT_WIDTH = 'w-[160px]'
const STATUS_WIDTH = 'w-[116px]'

/** Everything `useSortable` (`@dnd-kit/sortable`) hands back that this row needs to render as a
 * draggable item — assembled by the private `SortableEditPlanTableRow` wrapper in
 * `EditPlanTable.tsx` (the component that actually calls `useSortable`) and passed down here as
 * one prop, so `EditPlanTableRow` itself stays dnd-kit-agnostic beyond this one type. Absent
 * entirely when the row isn't draggable (`EditPlanTable`'s `canReorder` is false, see
 * `useEditPlanForm`) — that's also how the row knows not to render a grip handle at all. */
export type EditPlanRowDragHandle = {
    setNodeRef: (node: HTMLElement | null) => void
    setActivatorNodeRef: (node: HTMLElement | null) => void
    style?: CSSProperties
    isDragging: boolean
    attributes: DraggableAttributes
    listeners: DraggableSyntheticListeners
}

type Props = {
    view: EditRowView
    onFieldChange: (field: 'turnover' | 'margin', value: string) => void
    /** Показывать колонку "Типы заказов" и принимать её правки — только для `direction ===
     * 'service'` (см. `EditPlanTable`): у `shop` нет справочника `RoappOrderType`, см. PRD
     * "не в скоупе". */
    showOrderTypes: boolean
    orderTypes: OrderTypeResponse[]
    isOrderTypesLoading?: boolean
    onOrderTypeIdsChange: (orderTypeIds: number[]) => void
    dragHandle?: EditPlanRowDragHandle
}

/** One editable category row inside `EditPlanTable` (Pencil: `wumav` → `F7qa7`/`fdVVV`/...) —
 * an optional drag handle (Фаза 2, docs/sales-plan-row-drag-and-drop-reorder — see
 * `dragHandle`/`EditPlanRowDragHandle` above), name + "было X ₽"/margin-ratio note, the two
 * editable turnover/margin cells (highlighted while the row is dirty), the optional "Типы
 * заказов" multiselect (service only, Фаза 4 docs/service-plan-salary-rule-order-category-filter),
 * the read-only fact/выполнение cell, and a status chip: "Изменён" while dirty, otherwise the
 * row's real `plan.status` via `CellStatus`. */
export function EditPlanTableRow({
    view,
    onFieldChange,
    showOrderTypes,
    orderTypes,
    isOrderTypesLoading,
    onOrderTypeIdsChange,
    dragHandle,
}: Props) {
    const { row, values, draftTurnover, draftOrderTypeIds, isDirty } = view
    const factPercent = draftTurnover !== 0 ? formatPercent(row.fact.turnover, draftTurnover) : '0%'
    const marginPercent = row.plan.turnover !== 0 ? formatPercent(row.plan.margin, row.plan.turnover) : '0%'

    return (
        <div
            data-slot="edit-plan-table-row"
            ref={dragHandle?.setNodeRef}
            style={dragHandle?.style}
            className={cn(
                'flex h-[52px] items-center border-b border-hairline last:border-b-0',
                dragHandle?.isDragging && 'relative z-10 bg-surface opacity-70 shadow-md',
            )}
        >
            {dragHandle && (
                // `dragHandle?.` below, even though `dragHandle &&` already narrows it non-null —
                // the plain (non-optional) form trips `react-hooks/refs` ("Cannot access refs
                // during render") here, same as `useInfiniteScrollTrigger.ts`'s comment on that
                // rule elsewhere in the repo, just a different false-positive shape: the
                // optional-chaining form is what the rule's narrowing recognizes as safe.
                <button
                    type="button"
                    ref={dragHandle?.setActivatorNodeRef}
                    aria-label={`Изменить порядок: ${row.categoryName}`}
                    className={cn(
                        'flex h-full shrink-0 cursor-grab touch-none items-center justify-center text-ink-faint outline-none hover:text-ink-muted focus-visible:text-ink-muted active:cursor-grabbing',
                        HANDLE_WIDTH,
                    )}
                    {...dragHandle?.attributes}
                    {...dragHandle?.listeners}
                >
                    <GripVertical className="size-4" />
                </button>
            )}

            <div className={cn('flex h-full flex-col justify-center gap-0.5 px-3', CATEGORY_WIDTH)}>
                <span className="truncate font-ui text-[13px] font-semibold text-ink">{row.categoryName}</span>
                <span className={cn('truncate font-ui text-[11px]', isDirty ? 'text-warn' : 'text-ink-muted')}>
                    {isDirty ? `было ${formatCurrency(row.plan.turnover)}` : `маржа ${marginPercent} от выручки`}
                </span>
            </div>

            <div className={cn('flex h-full shrink-0 items-center px-2', INPUT_WIDTH)}>
                <EditPlanCellInput
                    aria-label={`План выручки: ${row.categoryName}`}
                    value={values.turnover}
                    isDirty={isDirty}
                    onChange={(value) => onFieldChange('turnover', value)}
                />
            </div>

            <div className={cn('flex h-full shrink-0 items-center px-2', INPUT_WIDTH)}>
                <EditPlanCellInput
                    aria-label={`План маржи: ${row.categoryName}`}
                    value={values.margin}
                    isDirty={isDirty}
                    onChange={(value) => onFieldChange('margin', value)}
                />
            </div>

            {showOrderTypes && (
                <div className={cn('flex h-full shrink-0 items-center px-2', ORDER_TYPES_WIDTH)}>
                    <OrderTypeSelect
                        aria-label={`Типы заказов: ${row.categoryName}`}
                        value={draftOrderTypeIds}
                        onValueChange={onOrderTypeIdsChange}
                        orderTypes={orderTypes}
                        isLoading={isOrderTypesLoading}
                        className={isDirty ? 'border-brand-border bg-brand-soft' : undefined}
                    />
                </div>
            )}

            <div className={cn('flex h-full shrink-0 flex-col items-end justify-center gap-0.5 px-3', FACT_WIDTH)}>
                <span className="font-ui text-[13px] font-medium text-ink">{formatCurrency(row.fact.turnover)}</span>
                <span className="font-ui text-[11px] text-ink-muted">
                    {factPercent} {isDirty ? 'от нового плана' : 'от плана'}
                </span>
            </div>

            <div className={cn('flex h-full shrink-0 items-center px-3', STATUS_WIDTH)}>
                {isDirty ? (
                    <span className="inline-flex w-fit shrink-0 items-center rounded-md bg-warn-soft px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap text-warn-ink">
                        Изменён
                    </span>
                ) : (
                    <CellStatus status={row.plan.status} />
                )}
            </div>
        </div>
    )
}

function EditPlanCellInput({
    value,
    isDirty,
    onChange,
    'aria-label': ariaLabel,
}: {
    value: string
    isDirty: boolean
    onChange: (value: string) => void
    'aria-label': string
}) {
    return (
        <input
            type="number"
            inputMode="decimal"
            aria-label={ariaLabel}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
                'h-8 w-full min-w-0 rounded-[6px] border px-2.5 text-right font-ui text-[13px] font-medium text-ink outline-none tabular-nums focus-visible:ring-2 focus-visible:ring-brand/40',
                '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                isDirty ? 'border-brand-border bg-brand-soft' : 'border-hairline bg-surface',
            )}
        />
    )
}
