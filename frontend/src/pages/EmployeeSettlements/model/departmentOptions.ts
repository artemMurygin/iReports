import type { TargetOption } from '@/features/TargetDirectory'

/** Sentinel `Select` value for "Все отделы" — Radix `Select` can't carry a `null`/empty item
 * value, so the department filter's real `departmentId` (`number | null`) is mapped to/from
 * this string at the UI boundary only; `useEmployeeSettlementsPage` still works with
 * `number | null` throughout (URL query param, `api.getBalanceSummary` filter). */
export const ALL_DEPARTMENTS_VALUE = 'all'

export type DepartmentSelectOption = {
    /** Radix `SelectItem` value — `ALL_DEPARTMENTS_VALUE` for the "Все отделы" row. */
    value: string
    /** `null` for "Все отделы" — the actual filter value `useEmployeeSettlementsPage` sends. */
    id: number | null
    label: string
}

/**
 * Pencil `IFJW2` filter row: department `Select` always leads with "Все отделы" (PRD default),
 * followed by the real Bitrix24 departments in the order `useDepartments()` returns them.
 */
export function buildDepartmentSelectOptions(departments: TargetOption[]): DepartmentSelectOption[] {
    return [
        { value: ALL_DEPARTMENTS_VALUE, id: null, label: 'Все отделы' },
        ...departments.map((department) => ({
            value: String(department.id),
            id: department.id,
            label: department.name,
        })),
    ]
}

/** Selected option's label for the `Select` trigger — falls back to "Все отделы" while the
 * directory is still loading or `departmentId` doesn't (yet) match a known department. */
export function resolveDepartmentLabel(options: DepartmentSelectOption[], departmentId: number | null): string {
    return options.find((option) => option.id === departmentId)?.label ?? 'Все отделы'
}
