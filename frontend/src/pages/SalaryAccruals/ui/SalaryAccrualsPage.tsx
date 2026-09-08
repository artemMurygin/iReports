import { AccruePeriodDialog, AccrueResultModal, AccrueSelectedDialog } from '@/features/SalaryAccruals'

import { useSalaryAccrualsPage } from '../model/useSalaryAccrualsPage.ts'
import { Layout } from './Layout.tsx'
import { PageHeader } from './PageHeader.tsx'
import { SalaryAccrualsBody } from './SalaryAccrualsBody.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, секция «Закрытие месяца и начисления»
 * (`uKNkE`) — `cfNlL` (`Начисления · Список`, desktop), `g6vEv` (empty-state «месяц ещё
 * не закрыт»), `Q0i6z3` (мобильный). Фаза 5 — чтение; Фаза 9 (мутации) добавляет Selection
 * Bar/«Начислить выбранным» (Selection Bar в `SalaryAccrualsBody`), «Начислить все
 * документы месяца» (`yDI1H`, кнопка в `PageHeader`) и их confirm/результат-диалоги,
 * смонтированные здесь — тот же приём, что `ClosePeriodDialog`/`ReopenPeriodDialog` в
 * `SalesPlanPage`'s `header`-слоте.
 *
 * Чистый медиатор (frontend/CLAUDE.md): всё состояние — в `useSalaryAccrualsPage`,
 * ветвления — в `SalaryAccrualsBody`.
 */
export function SalaryAccrualsPage() {
    const {
        direction,
        setDirection,
        period,
        setPeriod,
        periodLabel,
        directionLabel,
        isClosed,
        items,
        totals,
        statusCounts,
        statusFilter,
        setStatusFilter,
        search,
        setSearch,
        departments,
        isDepartmentsLoading,
        departmentId,
        setDepartmentId,
        departmentName,
        departmentNameById,
        footerNote,
        footerTotal,
        openAccrual,
        goToSalesPlan,
        isInitialLoad,
        isRefreshing,
        dataVersion,
        error,
        periodDirectionLabel,
        selection,
        nonPaidCount,
        selectedItems,
        isSelectedConfirmOpen,
        openSelectedConfirm,
        closeSelectedConfirm,
        isPeriodConfirmOpen,
        openPeriodConfirm,
        closePeriodConfirm,
        isBatchSubmitting,
        periodError,
        isAccruingPeriod,
        submitSelected,
        submitPeriod,
        result,
        isResultOpen,
        isRetrying,
        retryFailures,
        closeResult,
    } = useSalaryAccrualsPage()

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
                        departments={departments}
                        isDepartmentsLoading={isDepartmentsLoading}
                        departmentId={departmentId}
                        onDepartmentIdChange={setDepartmentId}
                        period={period}
                        onPeriodChange={setPeriod}
                        isPeriodClosed={isClosed}
                        nonPaidCount={nonPaidCount}
                        onAccrueAllMonth={openPeriodConfirm}
                    />

                    <AccrueSelectedDialog
                        open={isSelectedConfirmOpen}
                        onOpenChange={(open) => {
                            if (!open) closeSelectedConfirm()
                        }}
                        items={selectedItems}
                        isSubmitting={isBatchSubmitting}
                        onConfirm={() => void submitSelected()}
                    />

                    <AccruePeriodDialog
                        open={isPeriodConfirmOpen}
                        onOpenChange={(open) => {
                            if (!open) closePeriodConfirm()
                        }}
                        periodDirectionLabel={periodDirectionLabel}
                        count={nonPaidCount}
                        isSubmitting={isAccruingPeriod}
                        errorMessage={periodError}
                        onConfirm={submitPeriod}
                    />

                    <AccrueResultModal
                        open={isResultOpen}
                        onOpenChange={(open) => {
                            if (!open) closeResult()
                        }}
                        result={result}
                        isRetrying={isRetrying}
                        onRetryFailed={() => void retryFailures()}
                    />
                </>
            }
            body={
                <SalaryAccrualsBody
                    isClosed={isClosed}
                    periodLabel={periodLabel}
                    directionLabel={directionLabel}
                    departmentName={departmentName}
                    items={items}
                    totals={totals}
                    statusCounts={statusCounts}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    search={search}
                    onSearchChange={setSearch}
                    departmentNameById={departmentNameById}
                    footerNote={footerNote}
                    footerTotal={footerTotal}
                    onOpenAccrual={openAccrual}
                    onGoToSalesPlan={goToSalesPlan}
                    selection={selection}
                    onAccrueSelected={openSelectedConfirm}
                />
            }
        />
    )
}
