import type { RoleResponse } from 'ireports-contracts'

import { RoleList, RolePermissionMatrix } from '@/features/RoleManagement'
import type { PermissionMatrixRole } from '@/features/RoleManagement'

import { EmptyRolesState } from './EmptyRolesState.tsx'

/**
 * add-bitrix24-auth-and-rbac, раздел 20 tasks.md (20.3-20.4, 20.8); ui-design.md — вкладка
 * «Роли и права» (фрейм `s5nMLx`). Единственный презентационный компонент этой вкладки, которому
 * разрешено ветвление (frontend/CLAUDE.md, mediator-конвенция) — `mediator/RolesManagementPage`
 * только передаёт `isEmpty` (= `roles.length === 0`, посчитано в mediator) и хуки-колбэки.
 */
export type RolesAndPermissionsTabProps = {
    isEmpty: boolean
    roles: RoleResponse[]
    matrix: PermissionMatrixRole[]
    onCreateRole: (name: string) => void
    onRenameRole: (id: string, name: string) => void
    onDeleteRole: (id: string) => void
    onTogglePermission: (roleId: string, permissionCode: string) => void
    onSavePermissions: (roleId: string) => void
    isCreatingRole?: boolean
    isSavingPermissions?: boolean
}

function RolesAndPermissionsTab({
    isEmpty,
    roles,
    matrix,
    onCreateRole,
    onRenameRole,
    onDeleteRole,
    onTogglePermission,
    onSavePermissions,
    isCreatingRole,
    isSavingPermissions,
}: RolesAndPermissionsTabProps) {
    if (isEmpty) {
        return <EmptyRolesState onCreate={onCreateRole} isCreating={isCreatingRole} />
    }

    return (
        <div data-slot="roles-and-permissions-tab" className="flex flex-col gap-4">
            <RoleList
                roles={roles}
                onCreate={onCreateRole}
                onRename={onRenameRole}
                onDelete={onDeleteRole}
                isCreating={isCreatingRole}
            />
            <RolePermissionMatrix
                matrix={matrix}
                onToggle={onTogglePermission}
                onSave={onSavePermissions}
                isSaving={isSavingPermissions}
            />
        </div>
    )
}

export { RolesAndPermissionsTab }
