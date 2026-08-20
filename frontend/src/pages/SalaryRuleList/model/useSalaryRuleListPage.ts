import { useMemo } from 'react'

import { deriveTargetOptions } from './deriveTargetOptions.ts'
import { filterSchemas } from './filterSchemas.ts'
import { useMotivationSchemas } from './useMotivationSchemas.ts'
import { useSchemaFilters } from './useSchemaFilters.ts'

/**
 * Page-level mediator hook (flat-object convention, same shape as `pages/SalesPlan`'s
 * `useSalesPlanPage`) — composes `useMotivationSchemas` (mock-backed list, see `model/api.ts`) and
 * `useSchemaFilters` (local filter state), and derives the filtered list via the pure
 * `filterSchemas`. The "Отдел"/"Сотрудник" filter options come from `deriveTargetOptions(schemas)`
 * — NOT from `features/TargetDirectory`'s live Bitrix directory, which was tried first but produces
 * options unrelated to any loaded schema's `targetId` (see that file's comment). `SalaryRuleListPage`
 * only reads this hook's return value — all conditional rendering (`isEmpty`/`isFilteredEmpty`) is
 * handled by `SchemaListBody`, not here or in the page.
 */
export function useSalaryRuleListPage() {
    const schemasQuery = useMotivationSchemas()
    const filters = useSchemaFilters()

    const schemas = useMemo(() => schemasQuery.data ?? [], [schemasQuery.data])
    const targetOptions = useMemo(() => deriveTargetOptions(schemas), [schemas])

    const filteredSchemas = useMemo(
        () =>
            filterSchemas(schemas, {
                search: filters.search,
                direction: filters.direction,
                departmentId: filters.departmentId,
                employeeId: filters.employeeId,
            }),
        [schemas, filters.search, filters.direction, filters.departmentId, filters.employeeId],
    )

    const isLoading = schemasQuery.isLoading
    const errorMessage = schemasQuery.error?.message ?? null
    const isEmpty = !isLoading && errorMessage === null && schemas.length === 0
    const isFilteredEmpty = !isEmpty && filteredSchemas.length === 0

    return {
        schemas,
        filteredSchemas,
        totalCount: schemas.length,
        filteredCount: filteredSchemas.length,
        isLoading,
        errorMessage,
        isEmpty,
        isFilteredEmpty,
        departments: targetOptions.departments,
        isDepartmentsLoading: isLoading,
        employees: targetOptions.employees,
        isEmployeesLoading: isLoading,
        filters,
    }
}

export type SalaryRuleListPageState = ReturnType<typeof useSalaryRuleListPage>
