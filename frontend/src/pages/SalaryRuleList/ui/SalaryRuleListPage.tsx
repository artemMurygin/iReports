import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { PageHeader } from '@/shared/ui-kit/organisms/PageHeader'

import { pluralizeSchemas } from '../model/pluralizeSchemas.ts'
import { useSalaryRuleListPage } from '../model/useSalaryRuleListPage.ts'

import { SchemaListBody } from './SchemaListBody.tsx'
import { SchemaListFilters } from './SchemaListFilters.tsx'
import { SchemaListFiltersMobile } from './SchemaListFiltersMobile.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, nodes `zXpmh` (`Правила начисления · Список
 * (Десктоп)`) + `qJ0qx` (`... (Мобильный)`) — the list-of-schemas screen at `/salaries/rules`
 * (docs/salary-schema-list-ui). Root page component: calls `useSalaryRuleListPage()` and renders
 * `PageHeader` + `SchemaListFilters`/`SchemaListFiltersMobile` + `SchemaListBody`, delegating all
 * conditional rendering (loading/error/empty/filtered-empty/populated) to `SchemaListBody` — this
 * component itself contains no `&&`/ternary branching, per the mediator convention
 * (frontend/CLAUDE.md). The filter bar renders unconditionally, even while the list is empty —
 * `UlVij`'s empty-state mockup frame omits it, but keeping one page-level render tree (rather than
 * hiding the whole filters row behind another branch here) keeps that decision inside
 * `SchemaListBody` in spirit while avoiding a second branching point on this page.
 */
export function SalaryRuleListPage() {
    const {
        filteredSchemas,
        filteredCount,
        isLoading,
        errorMessage,
        isEmpty,
        isFilteredEmpty,
        departments,
        isDepartmentsLoading,
        employees,
        isEmployeesLoading,
        filters,
    } = useSalaryRuleListPage()

    const primaryAction = (
        <Button asChild className="w-full md:w-auto">
            <Link to="/salaries/rules/new">
                <Plus />
                Создать схему
            </Link>
        </Button>
    )

    return (
        <main className="flex flex-1 flex-col bg-canvas">
            <div className="flex flex-col gap-4 px-4 py-5 md:px-7 md:py-6">
                <PageHeader
                    title="Правила начисления"
                    subtitle="Мотивационные схемы начисления — по отделам и сотрудникам направлений Сервис и Магазин"
                    actions={primaryAction}
                />

                <SchemaListFilters
                    className="hidden md:block"
                    direction={filters.direction}
                    onDirectionChange={filters.setDirection}
                    schemaCountLabel={pluralizeSchemas(filteredCount)}
                    search={filters.search}
                    onSearchChange={filters.setSearch}
                    departments={departments}
                    departmentId={filters.departmentId}
                    onDepartmentIdChange={filters.setDepartmentId}
                    isDepartmentsLoading={isDepartmentsLoading}
                    employees={employees}
                    employeeId={filters.employeeId}
                    onEmployeeIdChange={filters.setEmployeeId}
                    isEmployeesLoading={isEmployeesLoading}
                />

                <SchemaListFiltersMobile
                    className="md:hidden"
                    direction={filters.direction}
                    onDirectionChange={filters.setDirection}
                    search={filters.search}
                    onSearchChange={filters.setSearch}
                    departments={departments}
                    departmentId={filters.departmentId}
                    onDepartmentIdChange={filters.setDepartmentId}
                    isDepartmentsLoading={isDepartmentsLoading}
                    employees={employees}
                    employeeId={filters.employeeId}
                    onEmployeeIdChange={filters.setEmployeeId}
                    isEmployeesLoading={isEmployeesLoading}
                />

                <SchemaListBody
                    isLoading={isLoading}
                    errorMessage={errorMessage}
                    isEmpty={isEmpty}
                    isFilteredEmpty={isFilteredEmpty}
                    schemas={filteredSchemas}
                    totalCount={filteredCount}
                    onResetFilters={filters.resetFilters}
                />
            </div>
        </main>
    )
}
