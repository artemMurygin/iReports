import { useDepartmentBalancesPage } from '../model/useDepartmentBalancesPage.ts'
import { DepartmentBalancesBody } from './DepartmentBalancesBody.tsx'
import { Layout } from './Layout.tsx'
import { PageHeader } from './PageHeader.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, node `IFJW2` (`Баланс · Отдел`, десктоп) /
 * `iEYMb` (мобильный) — Фаза 10 docs/payroll-closing-and-accrual. Колонка «Остаток» — БЕЗ
 * разбивки по направлениям (баланс общий по сотруднику, Фаза 8b), в отличие от мокапа,
 * который показывает Direction Tabs как задел под будущую фильтрацию, которой на бэкенде
 * (`getDepartmentBalances`) пока нет.
 *
 * Чистый медиатор (frontend/CLAUDE.md): всё состояние — в `useDepartmentBalancesPage`,
 * единственное ветвление («отдел не выбран») — в `DepartmentBalancesBody`.
 */
export function DepartmentBalancesPage() {
    const {
        departmentId,
        setDepartmentId,
        period,
        setPeriod,
        periodLabel,
        departments,
        isDepartmentsLoading,
        employees,
        totals,
        isInitialLoad,
        isRefreshing,
        dataVersion,
        error,
    } = useDepartmentBalancesPage()

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
                    period={period}
                    onPeriodChange={setPeriod}
                />
            }
            body={
                <DepartmentBalancesBody
                    departmentId={departmentId}
                    employees={employees}
                    totals={totals}
                    periodLabel={periodLabel}
                />
            }
        />
    )
}
