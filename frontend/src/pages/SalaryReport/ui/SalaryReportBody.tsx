import type { SalaryReportScope } from '../model/useSalaryReportPage.ts'
import type { DepartmentReportVM, EmployeeReportVM } from '../model/types.ts'

import { DepartmentReportBody } from './DepartmentReportBody.tsx'
import { EmployeeReportBody } from './EmployeeReportBody.tsx'

export type SalaryReportBodyProps = {
    scope: SalaryReportScope

    employeeReport: EmployeeReportVM | null
    isEmployeeSelected: boolean
    isRuleExpanded: (key: string) => boolean
    onToggleRule: (key: string) => void

    departmentReport: DepartmentReportVM | null
    isDepartmentSelected: boolean
    isEmployeeExpanded: (employeeId: number) => boolean
    onToggleEmployee: (employeeId: number) => void

    isLoading: boolean
    errorMessage: string | null
}

/**
 * Единственная точка ветвления по `scope` ("Сотрудник" vs "Отдел") — вынесена из
 * `SalaryReportPage` в этот презентационный компонент, чтобы страница осталась чистой склейкой
 * `useSalaryReportPage()` -> пропсы (правило «медиатор без `&&`/тернарников», см.
 * `pages/SalesPlan/ui/SalesPlanPage.tsx` -> `SalesPlanBody.tsx`).
 */
export function SalaryReportBody({
    scope,
    employeeReport,
    isEmployeeSelected,
    isRuleExpanded,
    onToggleRule,
    departmentReport,
    isDepartmentSelected,
    isEmployeeExpanded,
    onToggleEmployee,
    isLoading,
    errorMessage,
}: SalaryReportBodyProps) {
    if (scope === 'employee') {
        return (
            <EmployeeReportBody
                report={employeeReport}
                isLoading={isLoading}
                errorMessage={errorMessage}
                isEmployeeSelected={isEmployeeSelected}
                isRuleExpanded={isRuleExpanded}
                onToggleRule={onToggleRule}
            />
        )
    }

    return (
        <DepartmentReportBody
            report={departmentReport}
            isLoading={isLoading}
            errorMessage={errorMessage}
            isDepartmentSelected={isDepartmentSelected}
            isEmployeeExpanded={isEmployeeExpanded}
            onToggleEmployee={onToggleEmployee}
        />
    )
}
