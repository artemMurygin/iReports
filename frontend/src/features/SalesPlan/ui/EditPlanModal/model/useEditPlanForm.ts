import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { arrayMove } from '@dnd-kit/sortable'
import { toast } from 'sonner'
import type { SalesDirection, UpdateSalesPlanOrderItem, UpdateSalesPlanOrderRequest } from 'ireports-contracts'

import { api } from '@/features/SalesPlan/model/api.ts'
import type { SalesPlanRow } from '@/features/SalesPlan/model/useSalesPlan.ts'
import {
    useUpdateSalesPlanRows,
    type PlanRowUpdate,
    type PlanRowUpdateResult,
} from '@/features/SalesPlan/model/useUpdateSalesPlanRows.ts'
import { useUpdateSalesPlanOrder } from '@/features/SalesPlan/model/useUpdateSalesPlanOrder.ts'

export type FieldValues = { turnover: string; margin: string; orderTypeIds: number[] }
type UpdateSalesPlanPayload = { turnover?: number; margin?: number; orderTypeIds?: number[] }

type UseEditPlanFormArgs = {
    open: boolean
    onOpenChange: (open: boolean) => void
    direction: SalesDirection
    rows: SalesPlanRow[]
}

/** One row plus its parsed draft numbers — `draftTurnover`/`draftMargin` fall back to the row's
 * current plan value while the field is empty/invalid, so summary totals and the Факт/выполнение
 * column stay numeric instead of flashing `NaN` mid-edit (`canSave`/`handleSave` do their own,
 * stricter validation and are what actually blocks saving an invalid value). */
export type EditRowView = {
    row: SalesPlanRow
    values: FieldValues
    draftTurnover: number
    draftMargin: number
    /** = `values.orderTypeIds` — no fallback/parsing needed unlike `draftTurnover`/`draftMargin`
     * (a multiselect has no "invalid intermediate text" state a plain number input does). */
    draftOrderTypeIds: number[]
    isDirty: boolean
}

export type EditPlanSummary = {
    categoriesCount: number
    editedCount: number
    draftTurnover: number
    draftMargin: number
    originalTurnover: number
    originalMargin: number
    factTurnover: number
}

const EMPTY_SUMMARY: EditPlanSummary = {
    categoriesCount: 0,
    editedCount: 0,
    draftTurnover: 0,
    draftMargin: 0,
    originalTurnover: 0,
    originalMargin: 0,
    factTurnover: 0,
}

function defaultFieldValues(row: SalesPlanRow): FieldValues {
    return { turnover: String(row.plan.turnover), margin: String(row.plan.margin), orderTypeIds: row.plan.orderTypeIds }
}

function parseOrFallback(value: string, fallback: number): number {
    const parsed = Number(value)
    return value.trim() !== '' && !Number.isNaN(parsed) ? parsed : fallback
}

/** Set-equality for `orderTypeIds` (order/duplicates don't carry meaning — a multiselect toggle
 * never produces a duplicate, and comparison against `row.plan.orderTypeIds` shouldn't depend on
 * either array's order). */
function sameOrderTypeIds(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false
    const sortedA = [...a].sort((x, y) => x - y)
    const sortedB = [...b].sort((x, y) => x - y)
    return sortedA.every((id, index) => id === sortedB[index])
}

/** Positional array equality for row-order ids — unlike `sameOrderTypeIds` above, order IS the
 * thing being compared here, so no sorting before comparing. */
function sameOrder(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    return a.every((id, index) => id === b[index])
}

/** Re-applies the local drag-and-drop draft order (`orderedIds`, a list of `plan.id`s) on top of
 * the current `rows` prop. A row whose id isn't in `orderedIds` yet (e.g. `rows` refetched in the
 * background while the modal was open, surfacing a category the draft order predates) is appended
 * at the end in its original relative order — same "unknown position -> goes last" rule the PRD
 * specifies for a template-less category on the read side (`orderSalesPlansByTemplate`), applied
 * here to a client-side draft-order gap instead of a missing server-side `sortOrder`. */
function applyDraftOrder(rows: SalesPlanRow[], orderedIds: string[]): SalesPlanRow[] {
    const rowById = new Map(rows.map((row) => [row.plan.id, row]))
    const ordered = orderedIds.map((id) => rowById.get(id)).filter((row): row is SalesPlanRow => row !== undefined)
    const orderedIdSet = new Set(orderedIds)
    const missing = rows.filter((row) => !orderedIdSet.has(row.plan.id))
    return [...ordered, ...missing]
}

function buildSuccessMessage(fieldUpdatesCount: number, orderChanged: boolean): string {
    const fieldsPart =
        fieldUpdatesCount === 0
            ? null
            : fieldUpdatesCount === 1
              ? 'План категории обновлён'
              : `Обновлено категорий: ${fieldUpdatesCount}`
    if (fieldsPart && orderChanged) return `${fieldsPart}, порядок сохранён`
    if (fieldsPart) return fieldsPart
    return 'Порядок категорий сохранён'
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

/**
 * Owns `EditPlanModal`'s editable state, validation and save flow, kept separate from its JSX
 * per frontend/CLAUDE.md's model/ui split.
 *
 * Re-seeds `values` from `rows`' current plan numbers every time the modal transitions from
 * closed -> open (render-time "adjusting state" comparison, same convention as
 * `useSalesPlanSelection`'s reset-on-direction-change, rather than a `useEffect`). Keyed on the
 * `open` transition itself (not on `rows`) so a previous failed-save draft isn't silently reset
 * out from under the user while the modal is still open for a retry, but reopening it later
 * always starts from fresh defaults.
 *
 * Row order (Фаза 2, docs/sales-plan-row-drag-and-drop-reorder) follows the exact same
 * "re-seed only on the open transition" rule via `orderedIds` (a plain list of `row.plan.id`,
 * reordered locally by `handleReorder` on every drag-and-drop, never touching the server until
 * `handleSave`): closing the modal without saving leaves `orderedIds` stale, but that's invisible
 * since nothing reads it while `open` is false, and the next open re-seeds it from `rows` (the
 * server's current, saved order) — so a discarded drag never survives a reopen. `canReorder` is
 * `true` for both directions — the batch order endpoint exists for both `service`
 * (`api.updateSalesPlanOrder`, Фаза 1) and `shop` (`api.updateShopSalesPlanOrder`, Фаза 4).
 */
export function useEditPlanForm({ open, onOpenChange, direction, rows }: UseEditPlanFormArgs) {
    const [values, setValues] = useState<Record<string, FieldValues>>({})
    const [orderedIds, setOrderedIds] = useState<string[]>([])
    const updateRows = useUpdateSalesPlanRows(direction)
    const updateOrder = useUpdateSalesPlanOrder(direction)

    // "Типы заказов" (Фаза 4, docs/service-plan-salary-rule-order-category-filter) — service-only
    // (RoApp; `shop`/МойСклад has no such concept, see the PRD's "не в скоупе"), so the
    // dictionary (`GET .../reports/order-type`) is only fetched for `direction === 'service'`.
    const showOrderTypes = direction === 'service'
    // Drag-and-drop reordering (docs/sales-plan-row-drag-and-drop-reorder) is available for both
    // directions — see this hook's own doc comment above.
    const canReorder = true
    const { data: orderTypes, isFetching: isOrderTypesFetching } = useQuery({
        ...api.getOrderTypes(),
        enabled: showOrderTypes,
        placeholderData: keepPreviousData,
    })

    const [wasOpen, setWasOpen] = useState(open)
    if (open !== wasOpen) {
        setWasOpen(open)
        if (open) {
            setValues(Object.fromEntries(rows.map((row) => [row.plan.id, defaultFieldValues(row)])))
            setOrderedIds(rows.map((row) => row.plan.id))
        }
    }

    function setField(planId: string, field: 'turnover' | 'margin', value: string) {
        setValues((prev) => ({ ...prev, [planId]: { ...prev[planId], [field]: value } }))
    }

    function setOrderTypeIds(planId: string, orderTypeIds: number[]) {
        setValues((prev) => ({ ...prev, [planId]: { ...prev[planId], orderTypeIds } }))
    }

    function getFieldValues(row: SalesPlanRow): FieldValues {
        return values[row.plan.id] ?? defaultFieldValues(row)
    }

    /** Drag-and-drop reorder handler passed down to `EditPlanTable`'s `onDragEnd` — moves
     * `activeId` to `overId`'s position in `orderedIds` (local state only, no network call, see
     * this hook's doc comment). Both ids are `plan.id`s from the same drag gesture inside the
     * modal's own `SortableContext`, so they're always found in `orderedIds`; the `-1` guard is
     * just defensive (matches `arrayMove`'s own no-op behavior for a not-found index). */
    function handleReorder(activeId: string, overId: string) {
        if (activeId === overId) return
        setOrderedIds((prev) => {
            const oldIndex = prev.indexOf(activeId)
            const newIndex = prev.indexOf(overId)
            if (oldIndex === -1 || newIndex === -1) return prev
            return arrayMove(prev, oldIndex, newIndex)
        })
    }

    const displayRows = applyDraftOrder(rows, orderedIds)

    // One `EditRowView` per row (draft numbers + dirty flag) — feeds both the table (per-row
    // highlight/"было X ₽" note) and `summary` below, computed once here instead of separately
    // re-derived in `EditPlanTable`/`EditPlanSummary`. Iterates `displayRows` (the local
    // drag-and-drop draft order), not `rows`, so the table renders in the order the user is
    // currently dragging, not the order it opened with.
    const rowViews: EditRowView[] = displayRows.map((row) => {
        const fieldValues = getFieldValues(row)
        const draftTurnover = parseOrFallback(fieldValues.turnover, row.plan.turnover)
        const draftMargin = parseOrFallback(fieldValues.margin, row.plan.margin)
        const draftOrderTypeIds = fieldValues.orderTypeIds
        return {
            row,
            values: fieldValues,
            draftTurnover,
            draftMargin,
            draftOrderTypeIds,
            isDirty:
                draftTurnover !== row.plan.turnover ||
                draftMargin !== row.plan.margin ||
                !sameOrderTypeIds(draftOrderTypeIds, row.plan.orderTypeIds),
        }
    })

    const summary: EditPlanSummary = rowViews.reduce<EditPlanSummary>(
        (acc, view) => ({
            categoriesCount: acc.categoriesCount + 1,
            editedCount: acc.editedCount + (view.isDirty ? 1 : 0),
            draftTurnover: acc.draftTurnover + view.draftTurnover,
            draftMargin: acc.draftMargin + view.draftMargin,
            originalTurnover: acc.originalTurnover + view.row.plan.turnover,
            originalMargin: acc.originalMargin + view.row.plan.margin,
            factTurnover: acc.factTurnover + view.row.fact.turnover,
        }),
        EMPTY_SUMMARY,
    )

    const updates: PlanRowUpdate[] = []
    let hasInvalidField = false

    for (const row of rows) {
        const field = values[row.plan.id]
        if (!field) continue

        const turnover = Number(field.turnover)
        const margin = Number(field.margin)
        if (
            field.turnover.trim() === '' ||
            field.margin.trim() === '' ||
            Number.isNaN(turnover) ||
            Number.isNaN(margin)
        ) {
            hasInvalidField = true
            continue
        }

        const payload: UpdateSalesPlanPayload = {}
        if (turnover !== row.plan.turnover) payload.turnover = turnover
        if (margin !== row.plan.margin) payload.margin = margin
        if (!sameOrderTypeIds(field.orderTypeIds, row.plan.orderTypeIds)) payload.orderTypeIds = field.orderTypeIds
        if (payload.turnover !== undefined || payload.margin !== undefined || payload.orderTypeIds !== undefined) {
            updates.push({ id: row.plan.id, categoryName: row.categoryName, ...payload })
        }
    }

    // `orderChanged`/`orderPayload` — compares the local draft order (`displayRows`) against the
    // order `rows` currently has (the last order the server confirmed), same "diff against live
    // props" shape as `updates` above comparing `values` against `row.plan.turnover`/`margin`.
    // `sortOrder` is sent as each row's plain index in the draft order (0, 1, 2, ...) — correct
    // whenever the modal holds the department's full row set (the common case, `editRows` with no
    // selection — see `SalesPlanPage`/`useSalesPlanPage`), matching Фаза 1's own initial backfill
    // scheme (sequential per department). If the modal was opened for a selected SUBSET of rows
    // only, reordering that subset renumbers just those categories starting at 0, which can shift
    // them ahead of untouched categories that keep their own (possibly higher) existing
    // `sortOrder` — a known limitation for that combination, not exercised by this phase's scope
    // (see the PRD's "не в скоупе": batch reordering of a multi-row selection).
    const currentOrderIds = rows.map((row) => row.plan.id)
    const draftOrderIds = displayRows.map((row) => row.plan.id)
    const orderChanged = canReorder && !sameOrder(draftOrderIds, currentOrderIds)
    const orderPayload: UpdateSalesPlanOrderRequest | null =
        orderChanged && displayRows.length > 0
            ? {
                  department: displayRows[0].department,
                  items: displayRows.map((row, index): UpdateSalesPlanOrderItem => ({
                      category: row.category,
                      sortOrder: index,
                  })),
              }
            : null

    const canSave =
        (updates.length > 0 || orderPayload !== null) &&
        !hasInvalidField &&
        !updateRows.isPending &&
        !updateOrder.isPending

    function handleCancel() {
        onOpenChange(false)
    }

    /**
     * Saves field edits and the reordered row position as one "Сохранить" action — both mutations
     * fire together (`Promise.allSettled`, same "fire N mutations in parallel, don't let one
     * rejection hide the other's outcome" shape `submitSelected` in
     * `pages/SalaryAccruals/model/useSalaryAccrualsPage.ts` uses for its own batch) rather than
     * sequentially, so a slow/failing order save doesn't delay the field PATCHes or vice versa.
     *
     * On full success: one success toast, modal closes. On ANY failure — the order PATCH
     * rejecting, the whole field-update batch rejecting (both unlikely in practice, see
     * `useUpdateSalesPlanRows`'s own comment on why it normally resolves with per-row
     * `ok: false` entries instead of rejecting), or some individual rows failing — the modal
     * stays open, an error toast names what went wrong, and NOTHING in local state (`values`,
     * `orderedIds`) is touched, so the user's edits and their drag-and-drop draft order are still
     * there to fix and retry (same "не закрывай модалку" contract the field-only save already
     * had, extended to cover the order mutation too).
     */
    async function handleSave() {
        if (!canSave) return

        const hasFieldUpdates = updates.length > 0

        const [rowsSettled, orderSettled] = await Promise.allSettled([
            hasFieldUpdates ? updateRows.mutateAsync(updates) : Promise.resolve<PlanRowUpdateResult[]>([]),
            orderPayload ? updateOrder.mutateAsync(orderPayload) : Promise.resolve(null),
        ])

        const rowResults = rowsSettled.status === 'fulfilled' ? rowsSettled.value : []
        const rowBatchRejected = rowsSettled.status === 'rejected'
        const rowFailures = rowResults.filter((result) => !result.ok)
        const orderRejected = orderSettled.status === 'rejected'

        if (!rowBatchRejected && !orderRejected && rowFailures.length === 0) {
            toast.success(buildSuccessMessage(updates.length, orderPayload !== null))
            onOpenChange(false)
            return
        }

        const descriptionParts: string[] = []
        if (rowBatchRejected) descriptionParts.push(errorMessage(rowsSettled.reason))
        if (rowFailures.length > 0) {
            descriptionParts.push(rowFailures.map((result) => `${result.categoryName}: ${result.error}`).join('; '))
        }
        if (orderRejected) descriptionParts.push('Порядок: ' + errorMessage(orderSettled.reason))

        const onlySomeRowsFailed =
            !rowBatchRejected && !orderRejected && rowFailures.length > 0 && rowFailures.length < rowResults.length
        toast.error(onlySomeRowsFailed ? 'Сохранены не все категории' : 'Не удалось сохранить план', {
            description: descriptionParts.join('; '),
        })
    }

    return {
        rowViews,
        summary,
        setField,
        setOrderTypeIds,
        canSave,
        isSaving: updateRows.isPending || updateOrder.isPending,
        handleCancel,
        handleSave,
        showOrderTypes,
        orderTypes: orderTypes ?? [],
        isOrderTypesFetching,
        canReorder,
        onReorder: handleReorder,
    }
}
