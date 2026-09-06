import { useState } from 'react'

import { useEmployeeRoleAssignment, useRolePermissionsMatrix, useRoles } from '@/features/RoleManagement'

import { RolesManagementBody, type RolesManagementTab } from '../ui/RolesManagementBody.tsx'

/**
 * add-bitrix24-auth-and-rbac, раздел 20.8 tasks.md; architecture.md `pages/RolesManagement/
 * mediator/RolesManagementPage`: "Оркестрация `model`-хуков `RoleManagement`, без условного
 * рендера" — вызывает три хука фичи (`useRoles`/`useRolePermissionsMatrix`/
 * `useEmployeeRoleAssignment`) и хранит только состояние активной вкладки (не рендер-ветвление,
 * а простое значение, переданное дальше как проп — само переключение "какой JSX показать" живёт
 * в `ui/RolesManagementBody.tsx`, frontend/CLAUDE.md, «Медиатор не должен содержать условного
 * рендера»).
 *
 * `useRoles()` и `useEmployeeRoleAssignment()` оба читают `GET /roles` (`ROLES_QUERY_KEY`) —
 * TanStack Query дедуплицирует одинаковый ключ между двумя одновременно смонтированными хуками,
 * поэтому `roles.roles` передаётся в обе вкладки (`RolesManagementBody`) одним и тем же пропом,
 * а не дублируется через `useEmployeeRoleAssignment().roles`. Смонтирован на `/settings/roles`
 * (`app/router.tsx`, `handle.requiredPermission: 'roles:manage'` — раздел 15 `app/route-guard`) —
 * третья вкладка раздела «Настройки» (`app/navigation.tsx`), ранее отдельный роут `/admin/roles`.
 *
 * `isEmpty` — `!roles.isLoading && roles.roles.length === 0`, а не просто `roles.roles.length ===
 * 0`: без гейта на `isLoading` пустое состояние (`uRNsj`) мигнуло бы на экране в момент между
 * монтированием и приходом первого ответа `GET /roles` (`roles.roles` — `[] `по умолчанию, пока
 * `useQuery` не отдал данные).
 */
export function RolesManagementPage() {
    const [activeTab, setActiveTab] = useState<RolesManagementTab>('roles')

    const roles = useRoles()
    const matrix = useRolePermissionsMatrix()
    const assignment = useEmployeeRoleAssignment()

    return (
        <RolesManagementBody
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isEmpty={!roles.isLoading && roles.roles.length === 0}
            roles={roles.roles}
            matrix={matrix.matrix}
            onCreateRole={roles.createRole}
            onRenameRole={roles.renameRole}
            onDeleteRole={roles.deleteRole}
            onTogglePermission={matrix.togglePermission}
            onSavePermissions={matrix.save}
            isCreatingRole={roles.isCreating}
            isSavingPermissions={matrix.isSaving}
            employees={assignment.employees}
            onAssignRole={assignment.assignRole}
            onRevokeRole={assignment.revokeRole}
        />
    )
}
