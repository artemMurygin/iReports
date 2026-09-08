import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { EmployeeResponse } from 'ireports-contracts'

import { ROLES_QUERY_KEY, ROLE_ASSIGNMENTS_QUERY_KEY, api } from './api.ts'

export type EmployeeWithRoles = EmployeeResponse & {
    departmentName?: string
    roleIds: string[]
}

/**
 * add-bitrix24-auth-and-rbac, раздел 19+20.7 tasks.md; architecture.md
 * `useEmployeeRoleAssignment`: "query (существующий `/directory/employees`)
 * + мутации ролей" -> `{ employees, assignRole, revokeRole }`.
 *
 * Раздел 20.7 закрывает ОТКРЫТЫЙ ВОПРОС раздела 19 (ни один эндпоинт `roles`
 * раньше не возвращал ТЕКУЩЕЕ назначение роль<->сотрудник): раздел 22 добавил
 * `GET /v1/roles/assignments` (`{employeeId, roleIds}[]`, только сотрудники
 * хотя бы с одной ролью) — здесь он сопоставляется со списком сотрудников
 * (`/directory/employees`) по `id`, недостающие сотрудники получают
 * `roleIds: []` (состояние «Роль не назначена», ui-design.md `F6d3a`).
 * `roles` (полный `GET /roles`) отдаётся рядом — нужен `ui/EmployeeRoleAssignment`
 * для названий бейджей и списка ролей, доступных для назначения.
 * `departmentName` — присоединяется из `GET /directory/departments`
 * (существующий read-only справочник, уже используемый тем же способом в
 * `pages/EmployeeIdentity/model/api.ts`), т.к. `/directory/employees` отдаёт
 * только `departmentId`, а макет показывает название отдела текстом.
 *
 * Мутации инвалидируют оба `ROLES_QUERY_KEY` и `ROLE_ASSIGNMENTS_QUERY_KEY`:
 * assign/revoke не меняют сам справочник сотрудников (`/directory/employees`)
 * или каталог/CRUD ролей, но напрямую меняют то, что отдаёт `GET
 * /roles/assignments` — без инвалидации второго ключа таблица сотрудников не
 * увидела бы новое назначение без ручного релоада страницы.
 */
export function useEmployeeRoleAssignment() {
    const queryClient = useQueryClient()
    const employeesQuery = useQuery(api.getEmployees())
    const rolesQuery = useQuery(api.getRoles())
    const assignmentsQuery = useQuery(api.getRoleAssignments())
    const departmentsQuery = useQuery(api.getDepartments())

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY })
        void queryClient.invalidateQueries({ queryKey: ROLE_ASSIGNMENTS_QUERY_KEY })
    }

    const assignRoleMutation = useMutation({
        mutationFn: ({ employeeId, roleId }: { employeeId: number; roleId: string }) =>
            api.assignRoleToEmployee(roleId, employeeId),
        onSuccess: invalidate,
    })

    const revokeRoleMutation = useMutation({
        mutationFn: ({ employeeId, roleId }: { employeeId: number; roleId: string }) =>
            api.revokeRoleFromEmployee(roleId, employeeId),
        onSuccess: invalidate,
    })

    const employees = useMemo<EmployeeWithRoles[]>(() => {
        const assignmentByEmployeeId = new Map((assignmentsQuery.data ?? []).map((a) => [a.employeeId, a.roleIds]))
        const departmentNameById = new Map((departmentsQuery.data ?? []).map((d) => [d.id, d.name]))

        return (employeesQuery.data ?? []).map((employee) => ({
            ...employee,
            departmentName: departmentNameById.get(employee.departmentId),
            roleIds: assignmentByEmployeeId.get(employee.id) ?? [],
        }))
    }, [employeesQuery.data, assignmentsQuery.data, departmentsQuery.data])

    return {
        employees,
        roles: rolesQuery.data ?? [],
        isLoading:
            employeesQuery.isLoading || rolesQuery.isLoading || assignmentsQuery.isLoading || departmentsQuery.isLoading,
        error: employeesQuery.error ?? rolesQuery.error ?? assignmentsQuery.error ?? departmentsQuery.error,
        assignRole: (employeeId: number, roleId: string) => assignRoleMutation.mutateAsync({ employeeId, roleId }),
        revokeRole: (employeeId: number, roleId: string) => revokeRoleMutation.mutateAsync({ employeeId, roleId }),
        isAssigning: assignRoleMutation.isPending,
        isRevoking: revokeRoleMutation.isPending,
    }
}
