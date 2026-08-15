import { useMemo, useState } from 'react'
import type { SalesDirection } from 'ireports-contracts'
import type { SalesPlanRow } from '@/features/SalesPlan/model/useSalesPlan.ts'

/**
 * Selection state for the plan category rows — checkboxes in `SalesPlanTable`/
 * `SalesPlanCardList`, the header "select all" checkbox, and the Selection Bar (`SelectionBar`/
 * `SelectionBarMobile`). Lives in `features/SalesPlan/model` (not `pages/SalesPlan`) so it's a
 * single source of truth shared by the table, the card list, and the Selection Bar without the
 * page threading raw `Set` plumbing between otherwise-unrelated presentational components.
 *
 * `row.plan.id` (the `SalesPlan.id` from `salesPerformanceSchema`) is the identifier, not
 * `row.category` — this is what `POST .../sales/plan/approve`'s `{ ids: string[] }` variant
 * expects (see `approveSalesPlanRequestSchema` in `contracts/commands/sales-plan.ts`), and the
 * approve mutation is the whole reason this selection exists.
 *
 * Resets whenever `direction` or `period` changes: switching Сервис/Магазин (or, if a period
 * picker is ever added, the period) swaps in a different set of category rows entirely, so a
 * previously selected id would silently point at a row that's no longer on screen.
 */
export function useSalesPlanSelection(direction: SalesDirection, period: string, rows: SalesPlanRow[]) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

    // Reset-on-prop-change via a render-time comparison (React's documented "adjusting state
    // when a prop changes" pattern, see https://react.dev/reference/react/useState#storing-
    // information-from-previous-renders) rather than a `useEffect` — calling `setState`
    // synchronously inside an effect body causes an extra render round-trip and trips
    // `react-hooks/set-state-in-effect`; this bails out within the same render instead.
    const resetKey = `${direction}:${period}`
    const [prevResetKey, setPrevResetKey] = useState(resetKey)
    if (resetKey !== prevResetKey) {
        setPrevResetKey(resetKey)
        setSelectedIds(new Set())
    }

    const rowIds = useMemo(() => rows.map((row) => row.plan.id), [rows])

    const selectedCount = selectedIds.size
    const isAllSelected = rowIds.length > 0 && rowIds.every((id) => selectedIds.has(id))
    const isIndeterminate = selectedCount > 0 && !isAllSelected

    function toggleRow(id: string) {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // Indeterminate/empty -> select every currently visible row; fully selected -> clear.
    function toggleAll() {
        setSelectedIds(isAllSelected ? new Set() : new Set(rowIds))
    }

    function clear() {
        setSelectedIds(new Set())
    }

    return {
        selectedIds,
        selectedCount,
        isSelected: (id: string) => selectedIds.has(id),
        isAllSelected,
        isIndeterminate,
        toggleRow,
        toggleAll,
        clear,
    }
}

export type SalesPlanSelection = ReturnType<typeof useSalesPlanSelection>
