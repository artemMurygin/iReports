import type { DepartmentReportVM, EmployeeReportVM, SalaryReportScope } from '@/features/SalaryReportData'

import { DepartmentReportBodyV2 } from './DepartmentReportBodyV2.tsx'
import { EmployeeReportBodyV2 } from './EmployeeReportBodyV2.tsx'

export type SalaryReportBodyV2Props = {
    scope: SalaryReportScope

    employeeReport: EmployeeReportVM | null
    isEmployeeSelected: boolean
    isRuleExpanded: (key: string) => boolean
    onToggleRule: (key: string) => void

    departmentReport: DepartmentReportVM | null
    isDepartmentSelected: boolean
    departmentName: string | null
    isEmployeeExpanded: (employeeId: number) => boolean
    onToggleEmployee: (employeeId: number) => void

    isLoading: boolean
    errorMessage: string | null
}

/**
 * Единственная точка ветвления по `scope` ("Сотрудник" vs "Отдел") для `/salaries` — тот же
 * приём, что и `pages/SalaryReport/ui/SalaryReportBody.tsx` (см. её комментарий: правило
 * «медиатор без `&&`/тернарников», `frontend/CLAUDE.md`), заведённый заново вместо
 * переиспользования, поскольку `pages` не может импортировать другую `pages`
 * (`boundaries/dependencies`).
 */
export function SalaryReportBodyV2({
    scope,
    employeeReport,
    isEmployeeSelected,
    isRuleExpanded,
    onToggleRule,
    departmentReport,
    isDepartmentSelected,
    departmentName,
    isEmployeeExpanded,
    onToggleEmployee,
    isLoading,
    errorMessage,
}: SalaryReportBodyV2Props) {
    if (scope === 'employee') {
        return (
            <EmployeeReportBodyV2
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
        <DepartmentReportBodyV2
            report={departmentReport}
            isLoading={isLoading}
            errorMessage={errorMessage}
            isDepartmentSelected={isDepartmentSelected}
            departmentName={departmentName}
            isEmployeeExpanded={isEmployeeExpanded}
            onToggleEmployee={onToggleEmployee}
        />
    )
}
