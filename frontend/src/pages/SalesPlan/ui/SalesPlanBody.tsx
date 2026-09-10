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
import type { SalesPlanDirectionFilter } from '@/pages/SalesPlan/model/useSalesPlanPage.ts'

import { KpiGridMobile } from './KpiGridMobile.tsx'
import { SalesPlanDirectionSection } from './SalesPlanDirectionSection.tsx'

type Props = {
    direction: SalesPlanDirectionFilter
    rows: SalesPlanRow[]
    /** Only relevant while `direction === 'all'` — the two per-direction row sets
     * `SalesPlanDirectionSection` renders read-only, one section each (see below). */
    serviceRows: SalesPlanRow[]
    shopRows: SalesPlanRow[]
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
    serviceRows,
    shopRows,
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

                    {direction === 'all' ? (
                        // "Все" — ни выбор строк, ни "Утвердить"/"Изменить план" не привязаны к
                        // одному направлению однозначно (см. PageHeader), поэтому оба раздела
                        // read-only: без Selection Bar и без чекбоксов (SalesPlanDirectionSection
                        // не передаёт selection-пропсы дальше в SalesPlanTable/SalesPlanCardList).
                        <>
                            <SalesPlanDirectionSection
                                direction="service"
                                title="Сервис"
                                rows={serviceRows}
                                periodLabel={periodLabel}
                            />
                            <SalesPlanDirectionSection
                                direction="shop"
                                title="Магазин"
                                rows={shopRows}
                                periodLabel={periodLabel}
                            />
                        </>
                    ) : (
                        <>
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
            )}
        </>
    )
}
