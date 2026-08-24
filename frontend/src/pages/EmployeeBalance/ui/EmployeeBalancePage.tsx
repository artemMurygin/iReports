import { DeleteTransactionDialog, NewTransactionDrawer } from '@/features/EmployeeBalance'

import { useEmployeeBalancePage } from '../model/useEmployeeBalancePage.ts'
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
 * `ps9b4` (десктоп-личный кабинет) / `lQM7O`, `b6g6Z` (мобильные), правки Фазы 8b —
 * баланс сотрудника ОБЩИЙ: без Direction Tabs и KPI-карточек по направлениям, одна
 * крупная цифра «Баланс» в шапке. Строки ленты не раскрываются (см.
 * `TransactionsLedger`); удаление ручного движения — confirm-модалка без комментария
 * (не «сторно»), `w3wDY`/`dypv7`.
 *
 * Чистый медиатор (frontend/CLAUDE.md): всё состояние — в `useEmployeeBalancePage`,
 * `readOnly` прокидывается вниз без ветвлений на этом уровне.
 */
export function EmployeeBalancePage({ readOnly = false }: EmployeeBalancePageProps) {
    const {
        employeeId,
        employeeName,
        departmentName,
        employeeNameById,
        balance,
        transactions,
        selectionTotal,
        period,
        setPeriod,
        selectedTypes,
        toggleType,
        clearTypes,
        isDrawerOpen,
        drawerKind,
        openIncomeDrawer,
        openOutcomeDrawer,
        closeDrawer,
        deleteTarget,
        requestDelete,
        closeDeleteDialog,
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
                    <BalanceHeader
                        employeeName={employeeName}
                        departmentName={departmentName}
                        balance={balance}
                        onAddIncome={openIncomeDrawer}
                        onAddOutcome={openOutcomeDrawer}
                        readOnly={readOnly}
                    />

                    <BalanceFilters
                        period={period}
                        onPeriodChange={setPeriod}
                        selectedTypes={selectedTypes}
                        onToggleType={toggleType}
                        onClearTypes={clearTypes}
                    />

                    <TransactionsLedger
                        transactions={transactions}
                        employeeNameById={employeeNameById}
                        selectionTotal={selectionTotal}
                        readOnly={readOnly}
                        onDeleteTransaction={requestDelete}
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
                </div>
            }
        />
    )
}
