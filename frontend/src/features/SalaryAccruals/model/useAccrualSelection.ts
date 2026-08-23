import { useMemo, useState } from 'react'
import type { SalaryAccrual } from 'ireports-contracts'

/**
 * Selection state for the accruals list rows — checkboxes in `AccrualsTable`, the header
 * "select all" checkbox, and the Selection Bar (Фаза 9 docs/payroll-closing-and-accrual, P1.2).
 * Same shape/приём as `useSalesPlanSelection` (features/SalesPlan/model), lives in
 * `features/SalaryAccruals/model` (not `pages/SalaryAccruals`) so it's a single source of
 * truth shared by the table and the Selection Bar without the page threading raw `Set`
 * plumbing between otherwise-unrelated presentational components.
 *
 * `PAID` documents are already fully accrued — they're excluded from `selectableIds`
 * entirely, so `toggleRow`/`toggleAll` never select one even if a stale id is passed in, and
 * `AccrualsTable` renders their checkbox `disabled`.
 *
 * Resets whenever `direction`/`period` changes, same reasoning as `useSalesPlanSelection`:
 * switching Сервис/Магазин or the month swaps in a different set of documents entirely.
 */
export function useAccrualSelection(direction: string, period: string, items: SalaryAccrual[]) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

    // Reset-on-prop-change via a render-time comparison (see useSalesPlanSelection's comment
    // for why this replaces a `useEffect`-based reset).
    const resetKey = `${direction}:${period}`
    const [prevResetKey, setPrevResetKey] = useState(resetKey)
    if (resetKey !== prevResetKey) {
        setPrevResetKey(resetKey)
        setSelectedIds(new Set())
    }

    const selectableIds = useMemo(() => items.filter((item) => item.status !== 'PAID').map((item) => item.id), [items])

    const selectedCount = selectedIds.size
    const isAllSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))
    const isIndeterminate = selectedCount > 0 && !isAllSelected

    function toggleRow(id: string) {
        if (!selectableIds.includes(id)) return
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    // Indeterminate/empty -> select every currently selectable row; fully selected -> clear.
    function toggleAll() {
        setSelectedIds(isAllSelected ? new Set() : new Set(selectableIds))
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

export type AccrualSelection = ReturnType<typeof useAccrualSelection>
