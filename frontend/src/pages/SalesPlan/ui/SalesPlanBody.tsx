import type { SalesDirection } from 'ireports-contracts'

import {
    KpiRow,
    SalesPlanCardList,
    SalesPlanEmptyState,
    SalesPlanTable,
    SelectionBar,
    SelectionBarMobile,
    type SalesPlanRow,
    type SalesPlanSelection,
    type SalesPlanTotals,
} from '@/features/SalesPlan'
import { Spinner } from '@/shared/ui/Spinner'

import { KpiGridMobile } from './KpiGridMobile.tsx'

type Props = {
    direction: SalesDirection
    rows: SalesPlanRow[]
    totals: SalesPlanTotals
    periodLabel: string
    hasData: boolean
    error: string | null
    isRefreshing: boolean
    selection: SalesPlanSelection
    hasApprovable: boolean
    isApproving: boolean
    onApprove: () => void
}

/**
 * `SalesPlanPage`'s `Layout` `body` slot — the refreshing indicator, KPI/selection/table block
 * and empty state, plus every conditional that decides which of them renders. Kept out of
 * `SalesPlanPage` itself so that mediator stays pure wiring (hook output -> slot props), per the
 * "mediator has no conditional logic" convention (`pages/ServicesReport/mediator`).
 */
export function SalesPlanBody({
    direction,
    rows,
    totals,
    periodLabel,
    hasData,
    error,
    isRefreshing,
    selection,
    hasApprovable,
    isApproving,
    onApprove,
}: Props) {
    return (
        <>
            {isRefreshing && (
                <div className="flex items-center justify-end gap-1.5 font-ui text-xs text-ink-muted">
                    <Spinner className="size-3.5" />
                    Обновление данных...
                </div>
            )}

            {(!error || hasData) && (
                <>
                    <KpiRow totals={totals} periodLabel={periodLabel} className="hidden md:block" />
                    <KpiGridMobile totals={totals} periodLabel={periodLabel} className="md:hidden" />

                    {selection.selectedCount > 0 && (
                        <>
                            <SelectionBar
                                selectedCount={selection.selectedCount}
                                direction={direction}
                                onClear={selection.clear}
                                onApprove={hasApprovable ? onApprove : undefined}
                                isApproving={isApproving}
                                className="hidden md:flex"
                            />
                            <SelectionBarMobile
                                selectedCount={selection.selectedCount}
                                onClear={selection.clear}
                                onApprove={hasApprovable ? onApprove : undefined}
                                isApproving={isApproving}
                                className="md:hidden"
                            />
                        </>
                    )}

                    {hasData ? (
                        <>
                            <SalesPlanTable
                                rows={rows}
                                className="hidden md:block"
                                selectedIds={selection.selectedIds}
                                onToggleRow={selection.toggleRow}
                                onToggleAll={selection.toggleAll}
                                isAllSelected={selection.isAllSelected}
                                isIndeterminate={selection.isIndeterminate}
                            />
                            <SalesPlanCardList
                                rows={rows}
                                direction={direction}
                                className="md:hidden"
                                selectedIds={selection.selectedIds}
                                onToggleRow={selection.toggleRow}
                            />
                        </>
                    ) : (
                        <SalesPlanEmptyState periodLabel={periodLabel} />
                    )}
                </>
            )}
        </>
    )
}
