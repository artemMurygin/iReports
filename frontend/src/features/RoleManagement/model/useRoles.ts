import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ROLES_QUERY_KEY, api } from './api.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 19 tasks.md; architecture.md
 * `useRoles`: "query + мутации CRUD" -> `{ roles, createRole, renameRole,
 * deleteRole }`. Все три мутации инвалидируют один и тот же
 * `ROLES_QUERY_KEY` — CRUD над ролью меняет только список ролей, не каталог
 * прав (`PERMISSIONS_CATALOG_QUERY_KEY`) и не справочник сотрудников.
 *
 * spec: roles#model-role-permission — создание роли (опционально сразу с
 * набором permissions ИЗ каталога) делает её доступной для назначения
 * немедленно, без деплоя: инвалидация кэша сразу после `onSuccess` даёт этот
 * эффект на клиенте.
 */
export function useRoles() {
    const queryClient = useQueryClient()
    const rolesQuery = useQuery(api.getRoles())

    const invalidate = () => {
        void queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY })
    }

    const createRoleMutation = useMutation({
        mutationFn: ({ name, permissionCodes }: { name: string; permissionCodes?: string[] }) =>
            api.createRole({ name, permissionCodes }),
        onSuccess: invalidate,
    })

    const renameRoleMutation = useMutation({
        mutationFn: ({ id, name }: { id: string; name: string }) => api.renameRole(id, { name }),
        onSuccess: invalidate,
    })

    const deleteRoleMutation = useMutation({
        mutationFn: (id: string) => api.deleteRole(id),
        onSuccess: invalidate,
    })

    return {
        roles: rolesQuery.data ?? [],
        isLoading: rolesQuery.isLoading,
        error: rolesQuery.error,
        createRole: (name: string, permissionCodes?: string[]) => createRoleMutation.mutateAsync({ name, permissionCodes }),
        renameRole: (id: string, name: string) => renameRoleMutation.mutateAsync({ id, name }),
        deleteRole: (id: string) => deleteRoleMutation.mutateAsync(id),
        isCreating: createRoleMutation.isPending,
        isRenaming: renameRoleMutation.isPending,
        isDeleting: deleteRoleMutation.isPending,
    }
}
