import type { SchemaDirectionFilter } from './useSchemaFilters.ts'
import type { MotivationSchemaListItem } from './types.ts'

export type SchemaFilters = {
    search: string
    direction: SchemaDirectionFilter
    departmentId: number | null
    employeeId: number | null
}

/**
 * Pure client-side filter over the already-loaded full list — the PRD explicitly rules out
 * pagination for this iteration, so there are no filter query params on the mock fetch to push this
 * logic server-side yet (see `pages/SalaryRuleList/index.ts`'s `mockDataPlan` comment in the
 * implementation plan). `departmentId`/`employeeId` are independent filters (mirrors the two
 * separate "Отдел"/"Сотрудник" selects in the mockup, `h4izP`) — setting both narrows to schemas
 * matching both, which for this data shape (one `targetType` per schema) always yields an empty
 * result; that is the correct, if unusual, outcome of two simultaneously active target filters.
 */
export function filterSchemas(schemas: MotivationSchemaListItem[], filters: SchemaFilters): MotivationSchemaListItem[] {
    const search = filters.search.trim().toLowerCase()

    return schemas.filter((schema) => {
        if (search !== '' && !schema.name.toLowerCase().includes(search)) return false
        if (filters.direction !== 'all' && schema.direction !== filters.direction) return false
        if (
            filters.departmentId !== null &&
            !(schema.targetType === 'Department' && schema.targetId === filters.departmentId)
        )
            return false
        if (
            filters.employeeId !== null &&
            !(schema.targetType === 'Employee' && schema.targetId === filters.employeeId)
        )
            return false
        return true
    })
}
