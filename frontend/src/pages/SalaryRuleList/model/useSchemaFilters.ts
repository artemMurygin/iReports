import { useState } from 'react'

export type SchemaDirectionFilter = 'all' | 'service' | 'shop'

/**
 * Flat model-хук с плоским объектом состояния (frontend/CLAUDE.md) — search text + direction tab +
 * department/employee target filters for the schema list. Filtering itself lives in
 * `filterSchemas.ts`, a pure function composed with this state at the page/mediator level
 * (`useSalaryRuleListPage.ts`), not inside this hook — this hook only owns the filter *state*.
 */
export function useSchemaFilters() {
    const [search, setSearch] = useState('')
    const [direction, setDirection] = useState<SchemaDirectionFilter>('all')
    const [departmentId, setDepartmentId] = useState<number | null>(null)
    const [employeeId, setEmployeeId] = useState<number | null>(null)

    function resetFilters() {
        setSearch('')
        setDirection('all')
        setDepartmentId(null)
        setEmployeeId(null)
    }

    const hasActiveFilters = search.trim() !== '' || direction !== 'all' || departmentId !== null || employeeId !== null

    return {
        search,
        setSearch,
        direction,
        setDirection,
        departmentId,
        setDepartmentId,
        employeeId,
        setEmployeeId,
        hasActiveFilters,
        resetFilters,
    }
}

export type SchemaFiltersState = ReturnType<typeof useSchemaFilters>
