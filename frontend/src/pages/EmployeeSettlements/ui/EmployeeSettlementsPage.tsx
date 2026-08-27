import { downloadEmployeeSettlementsCsv } from '../model/exportSettlementsCsv.ts'
import { useEmployeeSettlementsPage } from '../model/useEmployeeSettlementsPage.ts'
import { EmployeeSettlementsBody } from './EmployeeSettlementsBody.tsx'
import { Layout } from './Layout.tsx'
import { PageHeader } from './PageHeader.tsx'

/**
 * `/balance` — «Взаиморасчёты с сотрудниками» (Pencil: design/sallary-first-iteration.pen,
 * node `IFJW2` десктоп / `wZnzC` мобайл — docs/employee-settlements-page-redesign, Фазы 3-4).
 * Заменяет `pages/DepartmentBalances` (`/balance/department`) — тот же сквозной баланс
 * сотрудника, но без обязательного выбора отдела и с KPI/поиском по PRD; см.
 * `useEmployeeSettlementsPage`'s history для того, что изменилось.
 *
 * Чистый медиатор (frontend/CLAUDE.md): всё состояние — в `useEmployeeSettlementsPage`,
 * десктоп/мобайл-переключение (`hidden md:block`/`md:hidden`) и группировка по отделам —
 * внутри `EmployeeSettlementsBody`. `downloadEmployeeSettlementsCsv` («Выгрузить таблицу»,
 * Фаза 4) вызывается прямо здесь, а не в `PageHeader`, — это не условный рендер (нет
 * `&&`/тернарника, решающего ЧТО показать), а построение обработчика клика из уже
 * загруженных `employees`/`totals`, тем же приёмом, что `DepartmentReportHeaderActions` у
 * `/salaries`.
 */
export function EmployeeSettlementsPage() {
    const {
        departmentId,
        setDepartmentId,
        departments,
        isDepartmentsLoading,
        search,
        setSearch,
        employees,
        totals,
        dataAsOfLabel,
        isInitialLoad,
        isRefreshing,
        dataVersion,
        error,
    } = useEmployeeSettlementsPage()

    return (
        <Layout
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            dataVersion={dataVersion}
            error={error}
            header={
                <PageHeader
                    departments={departments}
                    isDepartmentsLoading={isDepartmentsLoading}
                    departmentId={departmentId}
                    onDepartmentIdChange={setDepartmentId}
                    employeesCount={employees.length}
                    search={search}
                    onSearchChange={setSearch}
                    dataAsOfLabel={dataAsOfLabel}
                    onExport={() => downloadEmployeeSettlementsCsv(employees, totals)}
                />
            }
            body={<EmployeeSettlementsBody employees={employees} totals={totals} departmentId={departmentId} />}
        />
    )
}
