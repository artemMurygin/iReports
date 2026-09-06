import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ROLES_QUERY_KEY, api } from './api.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 19 tasks.md; architecture.md
 * `useRolePermissionsMatrix`: "query + мутация" -> `{ matrix, togglePermission,
 * save, isSaving }`. `matrix` — декартово произведение ролей (`GET /roles`) и
 * каталога прав (`GET /roles/permissions`, read-only, spec:
 * roles#permission-catalog-from-code): строки — коды прав, столбцы — роли,
 * как того требует `ui/RolePermissionMatrix` (architecture.md).
 *
 * `updateRolePermissions` (`PATCH /roles/:id/permissions`) заменяет ВЕСЬ
 * набор permissions роли разом, а не патчит один код (spec:
 * roles#immediate-permission-changes) — поэтому чекбоксы сначала копятся в
 * локальном черновике `draft` (роль -> набор включённых кодов), и только
 * `save(roleId)` отправляет накопленный набор целиком; `togglePermission`
 * сам по себе запросов не делает.
 */
export interface PermissionMatrixCell {
    code: string
    label: string
    group: string
    checked: boolean
}

export interface PermissionMatrixRole {
    roleId: string
    roleName: string
    isSystem: boolean
    permissions: PermissionMatrixCell[]
}

export function useRolePermissionsMatrix() {
    const queryClient = useQueryClient()
    const rolesQuery = useQuery(api.getRoles())
    const catalogQuery = useQuery(api.getPermissionsCatalog())
    // Черновик по ролям, тронутым чекбоксами с последнего успешного `save`
    // (роль без записи в `draft` показывает серверное состояние как есть).
    const [draft, setDraft] = useState<Record<string, Set<string>>>({})

    const roles = rolesQuery.data ?? []

    const matrix = useMemo<PermissionMatrixRole[]>(
        () =>
            (rolesQuery.data ?? []).map((role) => {
                const codes = draft[role.id] ?? new Set(role.permissionCodes)
                return {
                    roleId: role.id,
                    roleName: role.name,
                    isSystem: role.isSystem,
                    permissions: (catalogQuery.data ?? []).map((permission) => ({
                        code: permission.code,
                        label: permission.label,
                        group: permission.group,
                        checked: codes.has(permission.code),
                    })),
                }
            }),
        [rolesQuery.data, catalogQuery.data, draft],
    )

    function togglePermission(roleId: string, permissionCode: string) {
        setDraft((prev) => {
            const role = roles.find((candidate) => candidate.id === roleId)
            const next = new Set(prev[roleId] ?? role?.permissionCodes ?? [])
            if (next.has(permissionCode)) {
                next.delete(permissionCode)
            } else {
                next.add(permissionCode)
            }
            return { ...prev, [roleId]: next }
        })
    }

    const saveMutation = useMutation({
        mutationFn: ({ roleId, permissionCodes }: { roleId: string; permissionCodes: string[] }) =>
            api.updateRolePermissions(roleId, { permissionCodes }),
        onSuccess: (_role, { roleId }) => {
            void queryClient.invalidateQueries({ queryKey: ROLES_QUERY_KEY })
            // Черновик роли больше не нужен — после инвалидации `roles`
            // подтянет то же самое сохранённое значение с сервера.
            setDraft((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== roleId)))
        },
    })

    async function save(roleId: string): Promise<void> {
        const codes = draft[roleId]
        if (!codes) return
        await saveMutation.mutateAsync({ roleId, permissionCodes: [...codes] })
    }

    return {
        matrix,
        togglePermission,
        save,
        isSaving: saveMutation.isPending,
        isLoading: rolesQuery.isLoading || catalogQuery.isLoading,
    }
}
