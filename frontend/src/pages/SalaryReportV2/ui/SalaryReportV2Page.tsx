import { PageHeader } from '@/shared/ui-kit/organisms/PageHeader'

import { useSalaryReportPage } from '../model/useSalaryReportPage.ts'

import { DepartmentReportHeaderActions } from './DepartmentReportHeaderActions.tsx'
import { EmployeeReportHeaderActions } from './EmployeeReportHeaderActions.tsx'
import { Layout } from './Layout.tsx'
import { SalaryReportBodyV2 } from './SalaryReportBodyV2.tsx'
import { SalaryReportFiltersV2 } from './SalaryReportFiltersV2.tsx'
import { SalaryReportHeading } from './SalaryReportHeading.tsx'

const NO_BREADCRUMBS: never[] = []

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
        period,
        setPeriod,
        isEmployeeSelected,
        departmentId,
        setDepartmentId,
        isDepartmentSelected,
        direction,
        setDirection,
        employeeSearch,
        setEmployeeSearch,
        departments,
        isDepartmentsLoading,
        isInitialLoad,
        isRefreshing,
        errorMessage,
        dataVersion,
        employeeReport,
        departmentReport,
        directionBreakdown,
        toggleRule,
        isRuleExpanded,
        toggleDirection,
        isDirectionExpanded,
        employeeName,
        employeeDepartmentName,
        isEmployeeIdentityLoading,
    } = useSalaryReportPage()

    const departmentName = departments.find((department) => department.id === departmentId)?.name ?? null

    const actions = (
        <>
            <EmployeeReportHeaderActions scope={scope} period={period} onPeriodChange={setPeriod} />
            <DepartmentReportHeaderActions scope={scope} report={departmentReport} />
        </>
    )

    const header = (
        <>
            <PageHeader
                breadcrumbs={NO_BREADCRUMBS}
                title={
                    <SalaryReportHeading
                        scope={scope}
                        employeeName={employeeName}
                        employeeDepartmentName={employeeDepartmentName}
                        isEmployeeIdentityLoading={isEmployeeIdentityLoading}
                    />
                }
                actions={actions}
            />

            <SalaryReportFiltersV2
                scope={scope}
                departments={departments}
                isDepartmentsLoading={isDepartmentsLoading}
                departmentId={departmentId}
                onDepartmentIdChange={setDepartmentId}
                direction={direction}
                onDirectionChange={setDirection}
                employeeSearch={employeeSearch}
                onEmployeeSearchChange={setEmployeeSearch}
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
            isDirectionExpanded={isDirectionExpanded}
            onToggleDirection={toggleDirection}
            departmentReport={departmentReport}
            isDepartmentSelected={isDepartmentSelected}
            departmentName={departmentName}
            directionBreakdown={directionBreakdown}
            employeeSearch={employeeSearch}
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
