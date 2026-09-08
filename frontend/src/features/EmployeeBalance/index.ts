// Отклонение от конвенции «index.ts реэкспортирует только корневой UI-компонент»
// (frontend/CLAUDE.md) — тот же прецедент, что features/SalaryAccruals: у фичи
// нет единого корня, её собирают минимум две страницы (pages/EmployeeBalance —
// лента баланса сотрудника, pages/DepartmentBalances — сводка по отделу, Фаза 10
// docs/payroll-closing-and-accrual), поэтому наружу отдаётся модель.
export {
    api,
    EMPLOYEE_BALANCE_QUERY_KEY_PREFIX,
    DEPARTMENT_BALANCES_QUERY_KEY_PREFIX,
    BALANCE_SUMMARY_QUERY_KEY_PREFIX,
    ERP_CASH_CONFIG_QUERY_KEY_PREFIX,
    HARDCODED_CREATED_BY,
} from './model/api.ts'
export {
    useInvalidateEmployeeBalanceData,
    useCreateTransaction,
    useDeleteTransaction,
    useCreatePayout,
    useDeletePayout,
} from './model/useEmployeeBalanceMutations.ts'
export {
    INCOME_TRANSACTION_TYPES,
    OUTCOME_TRANSACTION_TYPES,
    type OutcomeTransactionType,
} from './model/manualTransactionTypes.ts'
export {
    transactionTypeLabel,
    DIRECTION_LABEL,
    ERP_SYSTEM_LABEL,
    isDeletable,
    isPayoutTransaction,
} from './model/transactionLabels.ts'
export {
    readPayoutErrorMessage,
    readPayoutConfirmationRequired,
    resolvePayoutCashLabel,
} from './model/payoutHelpers.ts'
// UI (Фаза 10 docs/payroll-closing-and-accrual): drawer нового движения и confirm
// удаления, собираемые pages/EmployeeBalance. DeletePayoutDialog — Фаза 6
// docs/employee-settlements-page-redesign, перенесена из удалённой features/Payout
// (создание выплаты теперь тип «Выплата» в NewTransactionDrawer, удаление уже
// существующего движения PAYOUT из ленты остаётся отдельным диалогом).
export { NewTransactionDrawer, type NewTransactionKind } from './ui/NewTransactionDrawer.tsx'
export { DeleteTransactionDialog } from './ui/DeleteTransactionDialog.tsx'
export { DeletePayoutDialog } from './ui/DeletePayoutDialog.tsx'
