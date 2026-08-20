import { useState } from 'react'
import { toast } from 'sonner'
import type { SalesDirection } from 'ireports-contracts'

import {
    DEFAULT_DIRECTION,
    DEFAULT_PERIOD,
    formatPeriodLabel,
    useApproveSalesPlanRows,
    useSalesPlan,
    useSalesPlanSelection,
} from '@/features/SalesPlan'

/**
 * Owns all of `SalesPlanPage`'s state: `direction`/`period` selection, the `useSalesPlan` data
 * fetch, category-row selection, the edit-plan modal's open state + resolved edit set, and the
 * "Утвердить выбранное" approve flow. Returned as a flat object (same convention as
 * `useServicesAnalytics`/`useDeals`, see frontend/CLAUDE.md) so `SalesPlanPage` stays purely
 * presentational.
 *
 * `direction`/`period` are owned here (not inside `useSalesPlan`) so `PageHeader`'s Direction
 * Tabs and `PeriodPicker` can drive them — `useSalesPlan` switches its data source internally
 * based on the `direction`/`period` it's given, so the page stays direction/period-agnostic.
 *
 * `editRows` follows the selection-or-all rule the edit modal needs: `selection.selectedCount >
 * 0` -> only the selected rows, otherwise every row currently on screen for this
 * `direction`/`period` — computed here (not inside the modal) since it's the one place that
 * already holds both `rows` and `selection`.
 */
export function useSalesPlanPage() {
    const [direction, setDirection] = useState<SalesDirection>(DEFAULT_DIRECTION)
    const [period, setPeriod] = useState<string>(DEFAULT_PERIOD)
    const { rows, totals, isInitialLoad, isRefreshing, error, dataVersion } = useSalesPlan(direction, period)
    const selection = useSalesPlanSelection(direction, period, rows)
    const periodLabel = formatPeriodLabel(period)
    const hasData = rows.length > 0
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const editRows = selection.selectedCount > 0 ? rows.filter((row) => selection.isSelected(row.plan.id)) : rows

    // "Утвердить выбранное" (Selection Bar) — approveRows is keyed on `direction` just like
    // useUpdateSalesPlanRows, so switching Сервис/Магазин swaps in the right endpoint
    // (POST .../sales/plan/approve under the matching domain prefix, see
    // useApproveSalesPlanRows). `selectedRows`/`hasApprovable` decide whether the button gets a
    // handler at all: if every currently-selected row is already APPROVED there's nothing to
    // approve, so `onApprove` is left `undefined` and SelectionBar/SelectionBarMobile render it
    // disabled with an explanatory title instead.
    const approveRows = useApproveSalesPlanRows(direction)
    const selectedRows = rows.filter((row) => selection.isSelected(row.plan.id))
    const hasApprovable = selectedRows.some((row) => row.plan.status !== 'APPROVED')

    function handleApprove() {
        const ids = selectedRows.map((row) => row.plan.id)
        if (ids.length === 0) return

        approveRows.mutate(ids, {
            onSuccess: () => {
                toast.success(ids.length === 1 ? 'Категория утверждена' : `Утверждено категорий: ${ids.length}`)
                selection.clear()
            },
            onError: (mutationError) => {
                toast.error('Не удалось утвердить план продаж', { description: mutationError.message })
            },
        })
    }

    return {
        direction,
        setDirection,
        period,
        setPeriod,
        rows,
        totals,
        isInitialLoad,
        isRefreshing,
        error,
        dataVersion,
        selection,
        periodLabel,
        hasData,
        isEditModalOpen,
        setIsEditModalOpen,
        editRows,
        approveRows,
        hasApprovable,
        handleApprove,
    }
}
