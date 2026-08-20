import { EditPlanModal } from '@/features/SalesPlan'

import { useSalesPlanPage } from '../model/useSalesPlanPage.ts'
import { Layout } from './Layout.tsx'
import { PageHeader } from './PageHeader.tsx'
import { SalesPlanBody } from './SalesPlanBody.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, node `x2soj` (`План продаж · Список`, desktop,
 * `md:` and up) / `hYl0B` (`План продаж · Мобильный`, below `md:`) -> `T0FMcE` (`Content`).
 *
 * All state (direction/period, data fetch, selection, edit-modal, approve flow) lives in
 * `useSalesPlanPage`; every conditional that decides what renders lives in `SalesPlanBody`.
 * This component is a pure mediator (`frontend/CLAUDE.md`'s "Mediator-компонент") — it only
 * wires the hook's output into `Layout`'s `header`/`body` slots, no branching of its own.
 * Loading/empty/error handling itself (the `SpinnerPageLg`/fade-blur transition, the error
 * banner) lives in `Layout`/`RefreshTransitionLayout` — see those for the
 * `isInitialLoad`/`isRefreshing` convention (`useServicesAnalytics`/`useDeals`).
 */
export function SalesPlanPage() {
    const {
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
    } = useSalesPlanPage()

    return (
        <Layout
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            dataVersion={dataVersion}
            error={error}
            header={
                <>
                    <PageHeader
                        direction={direction}
                        onDirectionChange={setDirection}
                        period={period}
                        onPeriodChange={setPeriod}
                        onEditPlan={() => setIsEditModalOpen(true)}
                        editDisabled={!hasData}
                    />

                    <EditPlanModal
                        open={isEditModalOpen}
                        onOpenChange={setIsEditModalOpen}
                        direction={direction}
                        period={period}
                        rows={editRows}
                    />
                </>
            }
            body={
                <SalesPlanBody
                    direction={direction}
                    rows={rows}
                    totals={totals}
                    periodLabel={periodLabel}
                    hasData={hasData}
                    error={error}
                    isRefreshing={isRefreshing}
                    selection={selection}
                    hasApprovable={hasApprovable}
                    isApproving={approveRows.isPending}
                    onApprove={handleApprove}
                />
            }
        />
    )
}
