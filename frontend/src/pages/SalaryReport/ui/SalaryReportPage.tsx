import { PageHeader } from '@/shared/ui-kit/organisms/PageHeader'

import { useSalaryReportPage } from '../model/useSalaryReportPage.ts'

import { Layout } from './Layout.tsx'
import { SalaryReportBody } from './SalaryReportBody.tsx'
import { SalaryReportFilters } from './SalaryReportFilters.tsx'

const BREADCRUMBS = [{ label: 'Зарплата' }, { label: 'Отчёт по зарплате' }]

/**
 * `/salaries` — отчёт по зарплате сотрудника/отдела (Pencil: design/sallary-first-iteration.pen,
 * `t3QCM`/`Z0lgF` "Зарплата сотрудника" + `b6mfxv`/`d8XFk` "Отчёт: Зарплата отдела"). Чистый
 * мидиатор (`frontend/CLAUDE.md`) — весь стейт и запросы живут в `useSalaryReportPage`, вся
 * условная отрисовка — в `SalaryReportBody`; сама страница только собирает `Layout`'s
 * `header`/`body` слоты из результата хука, без собственного ветвления.
 */
export function SalaryReportPage() {
    const {
        scope,
        setScope,
        period,
        setPeriod,
        employeeId,
        setEmployeeId,
        isEmployeeSelected,
        departmentId,
        setDepartmentId,
        isDepartmentSelected,
        direction,
        setDirection,
        employees,
        isEmployeesLoading,
        departments,
        isDepartmentsLoading,
        isInitialLoad,
        isRefreshing,
        errorMessage,
        dataVersion,
        employeeReport,
        departmentReport,
        toggleRule,
        toggleEmployee,
        isRuleExpanded,
        isEmployeeExpanded,
    } = useSalaryReportPage()

    const header = (
        <>
            <PageHeader
                breadcrumbs={BREADCRUMBS}
                title="Отчёт по зарплате"
                subtitle="Начисления сотрудника или отдела по зарплатным правилам за период"
            />

            <SalaryReportFilters
                scope={scope}
                onScopeChange={setScope}
                employees={employees}
                isEmployeesLoading={isEmployeesLoading}
                employeeId={employeeId}
                onEmployeeIdChange={setEmployeeId}
                departments={departments}
                isDepartmentsLoading={isDepartmentsLoading}
                departmentId={departmentId}
                onDepartmentIdChange={setDepartmentId}
                direction={direction}
                onDirectionChange={setDirection}
                period={period}
                onPeriodChange={setPeriod}
            />
        </>
    )

    const body = (
        <SalaryReportBody
            scope={scope}
            employeeReport={employeeReport}
            isEmployeeSelected={isEmployeeSelected}
            isRuleExpanded={isRuleExpanded}
            onToggleRule={toggleRule}
            departmentReport={departmentReport}
            isDepartmentSelected={isDepartmentSelected}
            isEmployeeExpanded={isEmployeeExpanded}
            onToggleEmployee={toggleEmployee}
            isLoading={isInitialLoad}
            errorMessage={errorMessage}
        />
    )

    return (
        <Layout isInitialLoad={isInitialLoad} isRefreshing={isRefreshing} dataVersion={dataVersion} header={header} body={body} />
    )
}
