import { DeletePayoutDialog, PayoutBatchConfirmDialog, PayoutDrawer, PayoutResultModal } from '@/features/Payout'

import { usePayoutPage } from '../model/usePayoutPage.ts'
import { Layout } from './Layout.tsx'
import { PageHeader } from './PageHeader.tsx'
import { PayoutBody } from './PayoutBody.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, секция «Выплата зарплаты» (`OJyfu`) — `OKluo`
 * (десктоп) / `R6Ybh` (мобильный), `i9IXQ` (confirm массовой выплаты), `NPdCW` (результат),
 * `MuiAK`/`G8ckk`/`CZGJi`/`AqCRq` (drawer выплаты сотруднику, все состояния — Фаза 14
 * docs/payroll-closing-and-accrual, PRD 3).
 *
 * Чистый медиатор (frontend/CLAUDE.md): всё состояние — в `usePayoutPage`, условный рендер —
 * в `PayoutBody`.
 */
export function PayoutPage() {
    const {
        direction,
        setDirection,
        period,
        setPeriod,
        cashLabel,
        rows,
        statusFilter,
        setStatusFilter,
        statusCounts,
        search,
        setSearch,
        kpi,

        selectedIds,
        selectedRows,
        isAllSelected,
        isIndeterminate,
        toggleRow,
        toggleAll,
        clearSelection,

        payoutTarget,
        openPayoutDrawer,
        closePayoutDrawer,
        ledgerTransactions,

        deletePayoutTarget,
        requestDeletePayout,
        closeDeletePayoutDialog,
        isResolvingDeletePayout,

        isBatchConfirmOpen,
        openBatchConfirm,
        closeBatchConfirm,
        confirmNegativeBalance,
        setConfirmNegativeBalance,
        isBatchSubmitting,
        batchError,
        submitBatch,

        result,
        isResultOpen,
        isRetrying,
        retryFailures,
        closeResult,

        isInitialLoad,
        isRefreshing,
        dataVersion,
        error,
    } = usePayoutPage()

    const selectedAmount = selectedRows.reduce((sum, row) => sum + Math.max(row.balance, 0), 0)

    return (
        <Layout
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            dataVersion={dataVersion}
            error={error}
            header={
                <>
                    <PageHeader direction={direction} onDirectionChange={setDirection} period={period} onPeriodChange={setPeriod} cashLabel={cashLabel} />

                    <PayoutBatchConfirmDialog
                        open={isBatchConfirmOpen}
                        onOpenChange={(open) => {
                            if (!open) closeBatchConfirm()
                        }}
                        items={selectedRows}
                        isSubmitting={isBatchSubmitting}
                        confirmNegativeBalance={confirmNegativeBalance}
                        onConfirmNegativeBalanceChange={setConfirmNegativeBalance}
                        errorMessage={batchError}
                        onConfirm={submitBatch}
                    />

                    <PayoutResultModal
                        open={isResultOpen}
                        onOpenChange={(open) => {
                            if (!open) closeResult()
                        }}
                        result={result}
                        isRetrying={isRetrying}
                        onRetryFailed={retryFailures}
                    />

                    {payoutTarget !== null && (
                        <PayoutDrawer
                            open={payoutTarget !== null}
                            onOpenChange={(open) => {
                                if (!open) closePayoutDrawer()
                            }}
                            direction={direction}
                            employeeId={payoutTarget.employeeId}
                            employeeName={payoutTarget.name}
                            currentBalance={payoutTarget.balance}
                            cashLabel={cashLabel}
                            recentTransactions={ledgerTransactions}
                        />
                    )}

                    <DeletePayoutDialog transaction={deletePayoutTarget} onOpenChange={closeDeletePayoutDialog} />
                </>
            }
            body={
                <PayoutBody
                    kpi={kpi}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    statusCounts={statusCounts}
                    search={search}
                    onSearchChange={setSearch}
                    rows={rows}
                    selectedIds={selectedIds}
                    selectedCount={selectedIds.size}
                    selectedAmount={selectedAmount}
                    onToggleRow={toggleRow}
                    onToggleAll={toggleAll}
                    isAllSelected={isAllSelected}
                    isIndeterminate={isIndeterminate}
                    onClearSelection={clearSelection}
                    onPaySelected={openBatchConfirm}
                    onPay={openPayoutDrawer}
                    onDeletePayout={requestDeletePayout}
                    isResolvingDeletePayout={isResolvingDeletePayout}
                />
            }
        />
    )
}
