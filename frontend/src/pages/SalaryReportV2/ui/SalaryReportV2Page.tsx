import { PageHeader } from '@/shared/ui-kit/organisms/PageHeader'

import { useSalaryReportPage } from '../model/useSalaryReportPage.ts'

import { Layout } from './Layout.tsx'
import { SalaryReportBodyV2 } from './SalaryReportBodyV2.tsx'
import { SalaryReportFiltersV2 } from './SalaryReportFiltersV2.tsx'

const BREADCRUMBS = [{ label: 'Зарплата' }, { label: 'Отчёт по зарплате' }]

/**
 * `/salaries` — отчёт по зарплате сотрудника/отдела (Pencil: `design/sallary-first-iteration.pen`,
 * `wLtzp`/`b63e8p` "Зарплата сотрудника" + `wVa5g`/`z5BwMk` "Зарплата отдела"). Единственная
 * страница этого отчёта — прежний дизайн (`pages/SalaryReport`), временно живший рядом на роуте
 * `/salaries-v2` для сравнения, удалён; этот компонент занял основной путь `/salaries`.
 *
 * Чистый мидиатор (`frontend/CLAUDE.md`) — весь стейт и запросы живут в `useSalaryReportPage`
 * (тонкая обёртка над `features/SalaryReportData`'s `useSalaryReportSelection`, см. её комментарий),
 * вся условная отрисовка — в `SalaryReportBodyV2`; сама страница только собирает `Layout`'s
 * `header`/`body` слоты из результата хука, без собственного ветвления.
 */
export function SalaryReportV2Page() {
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

    const departmentName = departments.find((department) => department.id === departmentId)?.name ?? null

    const header = (
        <>
            <PageHeader
                breadcrumbs={BREADCRUMBS}
                title="Отчёт по зарплате"
                subtitle="Начисления сотрудника или отдела по зарплатным правилам за период"
            />

            <SalaryReportFiltersV2
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
        <SalaryReportBodyV2
            scope={scope}
            employeeReport={employeeReport}
            isEmployeeSelected={isEmployeeSelected}
            isRuleExpanded={isRuleExpanded}
            onToggleRule={toggleRule}
            departmentReport={departmentReport}
            isDepartmentSelected={isDepartmentSelected}
            departmentName={departmentName}
            isEmployeeExpanded={isEmployeeExpanded}
            onToggleEmployee={toggleEmployee}
            isLoading={isInitialLoad}
            errorMessage={errorMessage}
        />
    )

    return (
        <Layout
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            dataVersion={dataVersion}
            header={header}
            body={body}
        />
    )
}
