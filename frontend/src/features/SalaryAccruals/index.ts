// Отклонение от конвенции «index.ts реэкспортирует только корневой UI-компонент»
// (frontend/CLAUDE.md) — тот же прецедент, что features/SalesPlan и
// features/AccountingPeriod: у фичи нет единого корня, её собирают две страницы
// (pages/SalaryAccruals — список, pages/SalaryAccrualDocument — карточка) плюс
// pages/SalaryReport (бейдж статуса документа в отчёте сотрудника), поэтому наружу
// отдаётся модель + презентационные куски.
export { useSalaryAccruals, useSalaryAccrual } from './model/useSalaryAccruals.ts'
export { SALARY_ACCRUALS_QUERY_KEY_PREFIX } from './model/api.ts'
export {
    deriveListProgress,
    deriveDocumentProgress,
    deriveAccrualsSummary,
    countAdjustedLines,
    countByStatus,
    filterAccruals,
    employeeInitials,
    pluralizeLines,
    pluralizeRulesCount,
    pluralizeDocuments,
    STATUS_FILTERS,
} from './model/accrualView.ts'
export type { AccrualProgress, AccrualsSummary, AccrualStatusFilter } from './model/accrualView.ts'
export { ACCRUAL_STATUS_LABEL, ACCRUAL_LINE_STATUS_LABEL, ROLE_LABEL } from './model/labels.ts'
export { AccrualStatusBadge, AccrualLineStatusBadge, DismissedBadge } from './ui/AccrualStatusBadge.tsx'
export { AccrualProgressBar } from './ui/AccrualProgressBar.tsx'
export { AccrualsKpiRow } from './ui/AccrualsKpiRow.tsx'
export { AccrualStatusFilterRow } from './ui/AccrualStatusFilter.tsx'
export { AccrualsTable } from './ui/AccrualsTable.tsx'
export { AccrualCardList } from './ui/AccrualCardList.tsx'
export { AccrualsEmptyState } from './ui/AccrualsEmptyState.tsx'
export { AccrualLinesTable } from './ui/AccrualLinesTable.tsx'
export { AccrualLineCardList } from './ui/AccrualLineCardList.tsx'
