import type { PayoutEmployeeRow } from 'ireports-contracts'

import type { PayoutStatusFilter } from '@/features/Payout'

import type { PayoutKpi } from './PayoutKpiRow.tsx'
import { PayoutCardList } from './PayoutCardList.tsx'
import { PayoutFilters } from './PayoutFilters.tsx'
import { PayoutKpiRow } from './PayoutKpiRow.tsx'
import { PayoutTable } from './PayoutTable.tsx'
import { SelectionBar } from './SelectionBar.tsx'

export type PayoutBodyProps = {
    kpi: PayoutKpi
    statusFilter: PayoutStatusFilter
    onStatusFilterChange: (filter: PayoutStatusFilter) => void
    statusCounts: Record<PayoutStatusFilter, number>
    search: string
    onSearchChange: (search: string) => void
    rows: PayoutEmployeeRow[]
    selectedIds: Set<number>
    selectedCount: number
    selectedAmount: number
    onToggleRow: (employeeId: number) => void
    onToggleAll: () => void
    isAllSelected: boolean
    isIndeterminate: boolean
    onClearSelection: () => void
    onPaySelected: () => void
    onPay: (row: PayoutEmployeeRow) => void
    onDeletePayout: (row: PayoutEmployeeRow) => void
    isResolvingDeletePayout: boolean
}

/**
 * Единственное место условного рендера страницы (frontend/CLAUDE.md: медиатор без if) —
 * Selection Bar видна только при `selectedCount > 0`, десктопная таблица/мобильные карточки
 * переключаются брейкпоинтом (тот же приём, что `TransactionsLedger`).
 */
function PayoutBody({
    kpi,
    statusFilter,
    onStatusFilterChange,
    statusCounts,
    search,
    onSearchChange,
    rows,
    selectedIds,
    selectedCount,
    selectedAmount,
    onToggleRow,
    onToggleAll,
    isAllSelected,
    isIndeterminate,
    onClearSelection,
    onPaySelected,
    onPay,
    onDeletePayout,
    isResolvingDeletePayout,
}: PayoutBodyProps) {
    return (
        <div className="flex flex-col gap-4">
            <PayoutKpiRow kpi={kpi} />
            <PayoutFilters value={statusFilter} onChange={onStatusFilterChange} counts={statusCounts} search={search} onSearchChange={onSearchChange} />

            {selectedCount > 0 && (
                <SelectionBar selectedCount={selectedCount} totalAmount={selectedAmount} onClear={onClearSelection} onPaySelected={onPaySelected} />
            )}

            <PayoutTable
                rows={rows}
                selectedIds={selectedIds}
                onToggleRow={onToggleRow}
                onToggleAll={onToggleAll}
                isAllSelected={isAllSelected}
                isIndeterminate={isIndeterminate}
                onPay={onPay}
                onDeletePayout={onDeletePayout}
                isResolvingDeletePayout={isResolvingDeletePayout}
                className="hidden md:block"
            />
            <PayoutCardList
                rows={rows}
                selectedIds={selectedIds}
                onToggleRow={onToggleRow}
                onPay={onPay}
                onDeletePayout={onDeletePayout}
                isResolvingDeletePayout={isResolvingDeletePayout}
                className="md:hidden"
            />
        </div>
    )
}

export { PayoutBody }
