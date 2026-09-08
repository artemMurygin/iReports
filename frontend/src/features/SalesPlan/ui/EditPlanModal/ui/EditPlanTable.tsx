import type { OrderTypeResponse } from 'ireports-contracts'
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core'
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { cn } from '@/shared/lib/tw'
import { ColumnHeader } from '@/shared/ui-kit/molecules/ColumnHeader'
import type { EditPlanSummary, EditRowView } from '@/features/SalesPlan/ui/EditPlanModal/model/useEditPlanForm.ts'
import { formatCurrency, formatPercent, pluralizeCategories } from '@/features/SalesPlan/model/format.ts'
import { EditPlanTableRow, HANDLE_WIDTH } from '@/features/SalesPlan/ui/EditPlanModal/ui/EditPlanTableRow.tsx'

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
    /** Фаза 2 + Фаза 4, docs/sales-plan-row-drag-and-drop-reorder — можно ли перетаскивать
     * строки (см. `useEditPlanForm.canReorder`, `true` для обоих направлений). Когда `false`,
     * строки рендерятся без обвязки `@dnd-kit` вообще (не только без ручки). */
    canReorder: boolean
    /** Локальный (без запроса на сервер) реордер — `activeId`/`overId` это `plan.id` строк,
     * которые пользователь перетащил друг относительно друга; см. `useEditPlanForm.handleReorder`. */
    onReorder: (activeId: string, overId: string) => void
}

/** `EditPlanModal`'s "Plan Editor Table" slot (Pencil: `wumav` → `O2SAV7`) — header row, one
 * `EditPlanTableRow` per category, and a totals row summing the current draft values.
 *
 * Drag-and-drop (Фаза 2, docs/sales-plan-row-drag-and-drop-reorder) is `@dnd-kit`'s first real
 * usage in this repo (`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` were installed
 * but unused before this) — `DndContext`/`SortableContext` (`verticalListSortingStrategy`, since
 * rows stack vertically) are only mounted when `canReorder` is true; each row's own `useSortable`
 * call lives in the private `SortableEditPlanTableRow` wrapper below, not in `EditPlanTableRow`
 * itself, so the plain (non-draggable) row stays free of any `@dnd-kit` dependency.
 */
export function EditPlanTable({
    rowViews,
    summary,
    onFieldChange,
    showOrderTypes,
    orderTypes,
    isOrderTypesLoading,
    onOrderTypeIdsChange,
    canReorder,
    onReorder,
}: Props) {
    const factPercent = summary.draftTurnover !== 0 ? formatPercent(summary.factTurnover, summary.draftTurnover) : '0%'

    // `activationConstraint.distance` — a small drag threshold before a pointer-down on the
    // handle counts as a drag, so a plain click/tap on the handle doesn't jitter-trigger a
    // same-position "reorder". `KeyboardSensor` + `sortableKeyboardCoordinates` gives keyboard
    // users (Tab to the handle, arrow keys to move) the same reordering `useSortable`'s mouse/
    // touch path gets, for free.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return
        onReorder(String(active.id), String(over.id))
    }

    const rows = canReorder ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rowViews.map((view) => view.row.plan.id)} strategy={verticalListSortingStrategy}>
                {rowViews.map((view) => (
                    <SortableEditPlanTableRow
                        key={view.row.plan.id}
                        view={view}
                        onFieldChange={(field, value) => onFieldChange(view.row.plan.id, field, value)}
                        showOrderTypes={showOrderTypes}
                        orderTypes={orderTypes}
                        isOrderTypesLoading={isOrderTypesLoading}
                        onOrderTypeIdsChange={(orderTypeIds) => onOrderTypeIdsChange(view.row.plan.id, orderTypeIds)}
                    />
                ))}
            </SortableContext>
        </DndContext>
    ) : (
        rowViews.map((view) => (
            <EditPlanTableRow
                key={view.row.plan.id}
                view={view}
                onFieldChange={(field, value) => onFieldChange(view.row.plan.id, field, value)}
                showOrderTypes={showOrderTypes}
                orderTypes={orderTypes}
                isOrderTypesLoading={isOrderTypesLoading}
                onOrderTypeIdsChange={(orderTypeIds) => onOrderTypeIdsChange(view.row.plan.id, orderTypeIds)}
            />
        ))
    )

    return (
        <div data-slot="edit-plan-table" className="overflow-hidden rounded-[10px] border border-hairline bg-surface">
            <div className="overflow-x-auto">
                <div className={showOrderTypes ? 'min-w-[890px]' : 'min-w-[720px]'}>
                    <div className="flex items-center border-b border-hairline bg-canvas">
                        {canReorder && <span className={cn('shrink-0', HANDLE_WIDTH)} />}
                        <ColumnHeader label="Категория" className={CATEGORY_WIDTH} />
                        <ColumnHeader label="План выручки, ₽" align="end" className={INPUT_WIDTH} />
                        <ColumnHeader label="План маржи, ₽" align="end" className={INPUT_WIDTH} />
                        {showOrderTypes && <ColumnHeader label="Типы заказов" className={ORDER_TYPES_WIDTH} />}
                        <ColumnHeader label="Факт · выполнение" align="end" className={FACT_WIDTH} />
                        <ColumnHeader label="Статус" className={STATUS_WIDTH} />
                    </div>

                    {rows}

                    <div className="flex h-11 items-center border-t border-hairline bg-canvas">
                        {canReorder && <span className={cn('shrink-0', HANDLE_WIDTH)} />}
                        <span className={cn('truncate px-3 font-ui text-xs font-semibold text-ink', CATEGORY_WIDTH)}>
                            Итого · {summary.categoriesCount} {pluralizeCategories(summary.categoriesCount)}
                        </span>
                        <span
                            className={cn(
                                'shrink-0 truncate px-3 text-right font-ui text-xs font-semibold text-ink',
                                INPUT_WIDTH,
                            )}
                        >
                            {formatCurrency(summary.draftTurnover)}
                        </span>
                        <span
                            className={cn(
                                'shrink-0 truncate px-3 text-right font-ui text-xs font-semibold text-ink',
                                INPUT_WIDTH,
                            )}
                        >
                            {formatCurrency(summary.draftMargin)}
                        </span>
                        {showOrderTypes && <span className={cn('shrink-0', ORDER_TYPES_WIDTH)} />}
                        <span
                            className={cn(
                                'shrink-0 truncate px-3 text-right font-ui text-xs font-semibold text-ink',
                                FACT_WIDTH,
                            )}
                        >
                            {formatCurrency(summary.factTurnover)} · {factPercent}
                        </span>
                        <span className={cn('shrink-0', STATUS_WIDTH)} />
                    </div>
                </div>
            </div>
        </div>
    )
}

type SortableRowProps = {
    view: EditRowView
    onFieldChange: (field: 'turnover' | 'margin', value: string) => void
    showOrderTypes: boolean
    orderTypes: OrderTypeResponse[]
    isOrderTypesLoading?: boolean
    onOrderTypeIdsChange: (orderTypeIds: number[]) => void
}

/** The only place in this file that calls `useSortable` — one instance per row, keyed by
 * `plan.id` (stable for the lifetime of the modal: the id changes month-to-month, but the period
 * doesn't change while the modal is open). Assembles dnd-kit's return value into the single
 * `dragHandle` prop `EditPlanTableRow` expects (see its `EditPlanRowDragHandle` type) instead of
 * making the presentational row aware of `useSortable`'s own shape. */
function SortableEditPlanTableRow({ view, ...rowProps }: SortableRowProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
        id: view.row.plan.id,
    })

    return (
        <EditPlanTableRow
            view={view}
            {...rowProps}
            dragHandle={{
                setNodeRef,
                setActivatorNodeRef,
                style: { transform: CSS.Transform.toString(transform), transition: transition ?? undefined },
                isDragging,
                attributes,
                listeners,
            }}
        />
    )
}
