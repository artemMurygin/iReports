import { DeletePayoutDialog, DeleteTransactionDialog, NewTransactionDrawer } from '@/features/EmployeeBalance'

import { useEmployeeBalancePage } from '../model/useEmployeeBalancePage.ts'
import { BalanceActions } from './BalanceActions.tsx'
import { BalanceFilters } from './BalanceFilters.tsx'
import { BalanceHeader } from './BalanceHeader.tsx'
import { Layout } from './Layout.tsx'
import { TransactionsLedger } from './TransactionsLedger.tsx'

export type EmployeeBalancePageProps = {
    /** Личный кабинет сотрудника (будущий readOnly-маршрут, Фаза 10
     * docs/payroll-closing-and-accrual) — скрывает «Добавить приход/расход» и «Удалить».
     * Отдельный маршрут ещё не подключён, страница просто поддерживает пропс заранее. */
    readOnly?: boolean
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `L73YCK` (десктоп-руководитель) /
 * `ps9b4` (десктоп-личный кабинет) / `JTc29`, `lQM7O`, `b6g6Z` (мобильные), Фаза 5
 * docs/employee-settlements-page-redesign — баланс сотрудника ОБЩИЙ: без Direction Tabs
 * и KPI-карточек по направлениям, одна крупная цифра «Баланс» в шапке (Фаза 8b), панель
 * действий («Добавить приход/расход», «Выгрузить ленту») — отдельной строкой под ней
 * (`BalanceActions`). Строки ленты не раскрываются (см. `TransactionsLedger`); удаление
 * ручного движения — confirm-модалка без комментария (не «сторно»), `w3wDY`/`dypv7`.
 *
 * Выплата (Фаза 6 того же плана) больше не отдельная кнопка/`PayoutDrawer` — тип «Выплата»
 * выбирается в `NewTransactionDrawer` («Добавить расход»), см. WHY там же; `DeletePayoutDialog`
 * остаётся отдельным путём только для удаления уже существующего движения `PAYOUT` из ленты
 * (`onDeletePayout` ниже) — обе точки теперь из `features/EmployeeBalance`, бывшая
 * `features/Payout` удалена.
 *
 * Чистый медиатор (frontend/CLAUDE.md): всё состояние — в `useEmployeeBalancePage`,
 * `readOnly` прокидывается вниз без ветвлений на этом уровне.
 */
export function EmployeeBalancePage({ readOnly = false }: EmployeeBalancePageProps) {
    const {
        employeeId,
        employeeName,
        headerSubtitle,
        employeeNameById,
        balance,
        transactions,
        selectionTotal,
        hasNextPage,
        isFetchingNextPage,
        loadMoreTransactions,
        period,
        setPeriod,
        selectedTypes,
        toggleType,
        clearTypes,
        commentSearch,
        setCommentSearch,
        exportLedger,
        isDrawerOpen,
        drawerKind,
        openIncomeDrawer,
        openOutcomeDrawer,
        closeDrawer,
        deleteTarget,
        requestDelete,
        closeDeleteDialog,
        deletePayoutTarget,
        requestDeletePayout,
        closeDeletePayoutDialog,
        isInitialLoad,
        isRefreshing,
        dataVersion,
        error,
    } = useEmployeeBalancePage()

    return (
        <Layout
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            dataVersion={dataVersion}
            error={error}
            body={
                <div className="flex flex-col gap-4">
                    <BalanceHeader employeeName={employeeName} subtitle={headerSubtitle} balance={balance} />

                    <BalanceActions
                        onAddIncome={openIncomeDrawer}
                        onAddOutcome={openOutcomeDrawer}
                        period={period}
                        onPeriodChange={setPeriod}
                        onExport={exportLedger}
                        readOnly={readOnly}
                    />

                    <BalanceFilters
                        selectedTypes={selectedTypes}
                        onToggleType={toggleType}
                        onClearTypes={clearTypes}
                        search={commentSearch}
                        onSearchChange={setCommentSearch}
                    />

                    <TransactionsLedger
                        transactions={transactions}
                        employeeNameById={employeeNameById}
                        selectionTotal={selectionTotal}
                        readOnly={readOnly}
                        onDeleteTransaction={requestDelete}
                        onDeletePayout={requestDeletePayout}
                        hasNextPage={hasNextPage}
                        isFetchingNextPage={isFetchingNextPage}
                        onLoadMore={loadMoreTransactions}
                    />

                    <NewTransactionDrawer
                        open={isDrawerOpen}
                        onOpenChange={(open) => {
                            if (!open) closeDrawer()
                        }}
                        employeeId={employeeId}
                        initialKind={drawerKind}
                        currentBalance={balance}
                    />

                    <DeleteTransactionDialog transaction={deleteTarget} onOpenChange={closeDeleteDialog} />

                    <DeletePayoutDialog transaction={deletePayoutTarget} onOpenChange={closeDeletePayoutDialog} />
                </div>
            }
        />
    )
}
