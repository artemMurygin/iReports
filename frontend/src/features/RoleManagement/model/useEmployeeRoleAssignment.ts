import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ROLES_QUERY_KEY, api } from './api.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 19 tasks.md; architecture.md
 * `useEmployeeRoleAssignment`: "query (существующий `/directory/employees`)
 * + мутации ролей" -> `{ employees, assignRole, revokeRole }`.
 *
 * ОТКРЫТЫЙ ВОПРОС (см. финальный отчёт раздела 19, не решался
 * самостоятельно): ни этот хук, ни какой-либо другой backend-эндпоинт
 * модуля `roles` не возвращают ТЕКУЩЕЕ назначение роль<->сотрудник — `GET
 * /directory/employees` отдаёт только `{id, name, departmentId}` (`contracts/
 * commands/directory.ts`), а `RoleResponse` (`GET /roles`) отдаёт только
 * `permissionCodes`, без списка сотрудников роли. Сигнатура хука здесь
 * реализована буквально по architecture.md; сотрудник в `employees` не несёт
 * информации о своей текущей роли — секции 20 (`ui/EmployeeRoleAssignment`,
 * бейджи ролей/«Роль не назначена», ui-design.md фрейм `F6d3a`) понадобится
 * либо новый read-эндпоинт на бэкенде, либо расширение существующего.
 *
 * Мутации инвалидируют `ROLES_QUERY_KEY`, а не отдельный ключ сотрудников:
 * назначение/снятие роли не меняет сам справочник сотрудников
 * (`/directory/employees`), но потенциально влияет на то, что видит матрица
 * прав (`useRolePermissionsMatrix`) и любой другой потребитель списка ролей,
 * если он в будущем станет отражать назначения.
 */
export function useEmployeeRoleAssignment() {
    const queryClient = useQueryClient()
    const employeesQuery = useQuery(api.getEmployees())

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY })
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

    return {
        employees: employeesQuery.data ?? [],
        isLoading: employeesQuery.isLoading,
        error: employeesQuery.error,
        assignRole: (employeeId: number, roleId: string) => assignRoleMutation.mutateAsync({ employeeId, roleId }),
        revokeRole: (employeeId: number, roleId: string) => revokeRoleMutation.mutateAsync({ employeeId, roleId }),
        isAssigning: assignRoleMutation.isPending,
        isRevoking: revokeRoleMutation.isPending,
    }
}
