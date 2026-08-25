// Отклонение от конвенции «index.ts реэкспортирует только корневой UI-компонент»
// (frontend/CLAUDE.md) — тот же прецедент, что features/EmployeeBalance и
// features/SalaryAccruals: у фичи нет единого корня, её собирают минимум две страницы
// (pages/Payout — страница выплаты, pages/EmployeeBalance — та же форма выплаты со строки
// баланса сотрудника, Фаза 14 docs/payroll-closing-and-accrual), поэтому наружу отдаётся
// модель + презентационные куски.
export { api, PAYOUT_QUERY_KEY_PREFIX, ERP_CASH_CONFIG_QUERY_KEY_PREFIX, HARDCODED_CREATED_BY } from './model/api.ts'
export { useInvalidatePayoutData, useCreatePayout, useCreatePayoutBatch, useDeletePayout } from './model/usePayoutMutations.ts'
export {
    PAYOUT_STATUS_LABEL,
    PAYOUT_STATUS_FILTERS,
    PAYOUT_STATUS_FILTER_LABEL,
    employeeInitials,
    filterPayoutRows,
    countByPayoutStatusFilter,
    readPayoutErrorMessage,
    readPayoutConfirmationRequired,
    pluralizeEmployees,
    retryableOutcomes,
    type PayoutStatusFilter,
    type PayoutRetryableOutcome,
} from './model/payoutView.ts'
export { PayoutDrawer } from './ui/PayoutDrawer.tsx'
export { PayoutBatchConfirmDialog } from './ui/PayoutBatchConfirmDialog.tsx'
export { PayoutResultModal } from './ui/PayoutResultModal.tsx'
export { DeletePayoutDialog } from './ui/DeletePayoutDialog.tsx'
