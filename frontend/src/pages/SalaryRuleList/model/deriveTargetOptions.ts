import type { TargetOption } from '@/features/TargetDirectory'

import type { MotivationSchemaListItem } from './types.ts'

export type TargetOptionsByType = {
    departments: TargetOption[]
    employees: TargetOption[]
}

/**
 * The "Отдел"/"Сотрудник" filters must only ever offer targets that some loaded schema actually has
 * — otherwise (see code review) sourcing the two selects from the live Bitrix directory
 * (`features/TargetDirectory`'s `useDepartments`/`useEmployees`) while filtering a schema list whose
 * `targetId`s don't correspond to those same directory records (true both for today's mock data,
 * see `mockSchemas.ts`, and in general — a real backend's schema list is a *subset* of the full
 * directory) makes picking almost any department/employee guaranteed to yield "Ничего не найдено".
 * Deriving the options straight from the already-loaded `schemas` list instead keeps every option
 * selectable-with-results by construction, for the mock today and for a real `GET` response later
 * alike — this replaces `useDepartments`/`useEmployees` for this page only; `pages/SalaryRules`
 * (schema *creation*, where offering the full live directory to assign a target IS correct) keeps
 * using those hooks unchanged.
 */
export function deriveTargetOptions(schemas: MotivationSchemaListItem[]): TargetOptionsByType {
    const departments = new Map<number, string>()
    const employees = new Map<number, string>()

    for (const schema of schemas) {
        const target = schema.targetType === 'Department' ? departments : employees
        if (!target.has(schema.targetId)) target.set(schema.targetId, schema.targetName)
    }

    const toSortedOptions = (map: Map<number, string>): TargetOption[] =>
        Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ru'))

    return {
        departments: toSortedOptions(departments),
        employees: toSortedOptions(employees),
    }
}
