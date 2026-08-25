import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { SalesDirection } from 'ireports-contracts'

import { api } from '@/features/SalesPlan/model/api.ts'
import type { SalesPlanRow } from '@/features/SalesPlan/model/useSalesPlan.ts'
import { useUpdateSalesPlanRows, type PlanRowUpdate } from '@/features/SalesPlan/model/useUpdateSalesPlanRows.ts'

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
 */
export function useEditPlanForm({ open, onOpenChange, direction, rows }: UseEditPlanFormArgs) {
    const [values, setValues] = useState<Record<string, FieldValues>>({})
    const updateRows = useUpdateSalesPlanRows(direction)

    // "Типы заказов" (Фаза 4, docs/service-plan-salary-rule-order-category-filter) — service-only
    // (RoApp; `shop`/МойСклад has no such concept, see the PRD's "не в скоупе"), so the
    // dictionary (`GET .../reports/order-type`) is only fetched for `direction === 'service'`.
    const showOrderTypes = direction === 'service'
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

    // One `EditRowView` per row (draft numbers + dirty flag) — feeds both the table (per-row
    // highlight/"было X ₽" note) and `summary` below, computed once here instead of separately
    // re-derived in `EditPlanTable`/`EditPlanSummary`.
    const rowViews: EditRowView[] = rows.map((row) => {
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

    const canSave = updates.length > 0 && !hasInvalidField && !updateRows.isPending

    function handleCancel() {
        onOpenChange(false)
    }

    function handleSave() {
        if (!canSave) return

        updateRows.mutate(updates, {
            onSuccess: (results) => {
                const failed = results.filter((result) => !result.ok)

                if (failed.length === 0) {
                    toast.success(
                        updates.length === 1 ? 'План категории обновлён' : `Обновлено категорий: ${updates.length}`,
                    )
                    onOpenChange(false)
                    return
                }

                toast.error(
                    failed.length === results.length ? 'Не удалось сохранить план' : 'Сохранены не все категории',
                    {
                        description: failed.map((result) => `${result.categoryName}: ${result.error}`).join('; '),
                    },
                )
            },
            onError: (error) => {
                toast.error('Не удалось сохранить план', { description: error.message })
            },
        })
    }

    return {
        rowViews,
        summary,
        setField,
        setOrderTypeIds,
        canSave,
        isSaving: updateRows.isPending,
        handleCancel,
        handleSave,
        showOrderTypes,
        orderTypes: orderTypes ?? [],
        isOrderTypesFetching,
    }
}
