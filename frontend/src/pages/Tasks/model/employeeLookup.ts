import type { ListEmployeesResponse } from 'ireports-contracts'

/** `Task.assigneeEmployeeId` is only an id — this builds the `id -> name` map once (from the
 * page's own `tasksApi.getAssigneeEmployees()` query) instead of every row doing its own lookup. */
export function buildEmployeeNameById(employees: ListEmployeesResponse): Map<number, string> {
    return new Map(employees.map((employee) => [employee.id, employee.name]))
}

/** Same "first letters of the first two words" rule as `TaskStatusCard`'s local `initialsOf`. */
export function initialsOf(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
}
