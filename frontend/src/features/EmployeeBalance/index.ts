// Отклонение от конвенции «index.ts реэкспортирует только корневой UI-компонент»
// (frontend/CLAUDE.md) — тот же прецедент, что features/SalaryAccruals: у фичи
// нет единого корня, её собирают минимум две страницы (pages/EmployeeBalance —
// лента баланса сотрудника, pages/DepartmentBalances — сводка по отделу, Фаза 10
// docs/payroll-closing-and-accrual), поэтому наружу отдаётся модель.
export {
    api,
    EMPLOYEE_BALANCE_QUERY_KEY_PREFIX,
    DEPARTMENT_BALANCES_QUERY_KEY_PREFIX,
    HARDCODED_CREATED_BY,
} from './model/api.ts'
export {
    useInvalidateEmployeeBalanceData,
    useCreateTransaction,
    useDeleteTransaction,
} from './model/useEmployeeBalanceMutations.ts'
export { INCOME_TRANSACTION_TYPES, OUTCOME_TRANSACTION_TYPES } from './model/manualTransactionTypes.ts'
export { transactionTypeLabel, isDeletable } from './model/transactionLabels.ts'
// UI (Фаза 10 docs/payroll-closing-and-accrual): drawer нового движения и confirm
// удаления, собираемые pages/EmployeeBalance.
export { NewTransactionDrawer, type NewTransactionKind } from './ui/NewTransactionDrawer.tsx'
export { DeleteTransactionDialog } from './ui/DeleteTransactionDialog.tsx'
