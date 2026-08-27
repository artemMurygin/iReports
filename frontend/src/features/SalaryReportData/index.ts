// Отклонение от стандартной конвенции index.ts ("реэкспортирует только корневой UI-компонент
// фичи", см. frontend/CLAUDE.md): у этой фичи нет UI вовсе — только данные и стейт отчёта по
// зарплате (запросы, VM-типы, форматтеры) для pages/SalaryReportV2 (`/salaries`, Pencil
// design/sallary-first-iteration.pen). Тот же прецедент уже задокументирован в
// features/TargetDirectory/index.ts и features/SalesPlan/index.ts.
export { useSalaryReportSelection } from './model/useSalaryReportSelection.ts'
export type { SalaryReportSelectionState } from './model/useSalaryReportSelection.ts'

export { useEmployeeSalaryReport } from './model/useEmployeeSalaryReport.ts'
export type { UseEmployeeSalaryReportResult } from './model/useEmployeeSalaryReport.ts'
export { useDepartmentSalaryReport } from './model/useDepartmentSalaryReport.ts'
export type { UseDepartmentSalaryReportResult } from './model/useDepartmentSalaryReport.ts'
export { useSetTaskRuleActualAmount } from './model/useSetTaskRuleActualAmount.ts'

export {
    SALARY_DIRECTION_LABELS,
    isFloatPercentRule,
    getRulePercents,
    sumFactPrognose,
    sumAllFactPrognose,
} from './model/types.ts'
export type {
    SalaryDirection,
    SalaryReportScope,
    SalaryAccrualStatus,
    SalaryReportRule,
    SalaryReportRuleWithDirection,
    DirectionReportVM,
    EmployeeReportVM,
    DepartmentReportEmployeeVM,
    DepartmentReportVM,
} from './model/types.ts'

export {
    ROLE_LABELS,
    getRoleLabel,
    RULE_TYPE_LABELS,
    getRuleTypeLabel,
    TASK_RULE_STATUS_LABELS,
} from './model/labels.ts'
export { formatFloatPercentRange } from './model/formatFloatPercentRange.ts'
export { pluralizeEmployees } from './model/pluralizeEmployees.ts'
