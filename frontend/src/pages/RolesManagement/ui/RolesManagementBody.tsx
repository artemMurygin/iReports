import type { RoleResponse } from 'ireports-contracts'

import { EmployeeRoleAssignment } from '@/features/RoleManagement'
import type { EmployeeWithRoles, PermissionMatrixRole } from '@/features/RoleManagement'
import { Tabs, type TabItem } from '@/shared/ui-kit/molecules/Tabs'
import { PageHeader } from '@/shared/ui-kit/organisms/PageHeader'

import { RolesAndPermissionsTab } from './RolesAndPermissionsTab.tsx'

export type RolesManagementTab = 'roles' | 'employees'

const TABS: TabItem[] = [
    { id: 'roles', label: 'Роли и права' },
    { id: 'employees', label: 'Сотрудники' },
]

/**
 * add-bitrix24-auth-and-rbac, раздел 20.8 tasks.md; architecture.md `pages/RolesManagement/
 * mediator/RolesManagementPage`: "Оркестрация ... переключение вкладок «Роли и права»/
 * «Сотрудники» (без условного рендера внутри самого медиатора)" — переключение вкладок и весь
 * остальной условный рендер (в т.ч. пустое состояние `RolesAndPermissionsTab` уже несёт сама)
 * живёт здесь, presentational-компоненте, а не в `mediator/RolesManagementPage` (frontend/
 * CLAUDE.md, «Медиатор/страница не должен содержать условного рендера»).
 *
 * ui-design.md `s5nMLx`/`F6d3a`: обе вкладки используют один и тот же `ERP/Organism/Page Header`
 * (заголовок «Роли и права» не меняется между вкладками — подзаголовок описывает страницу
 * целиком, не конкретную вкладку) и один и тот же `ERP/Molecule/Tabs` (`Tabs.tsx`, третий
 * неиспользуемый таб уже отключён на уровне компонента).
 */
export type RolesManagementBodyProps = {
    activeTab: RolesManagementTab
    onTabChange: (tab: RolesManagementTab) => void
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
    employees: EmployeeWithRoles[]
    onAssignRole: (employeeId: number, roleId: string) => void
    onRevokeRole: (employeeId: number, roleId: string) => void
}

function RolesManagementBody({
    activeTab,
    onTabChange,
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
    employees,
    onAssignRole,
    onRevokeRole,
}: RolesManagementBodyProps) {
    return (
        <main data-slot="roles-management" className="flex flex-1 flex-col gap-5 bg-canvas px-8 py-8">
            <PageHeader
                title="Роли и права"
                subtitle="Кто и что может делать в iReports — роли сотрудников и права доступа к разделам"
            />

            <Tabs tabs={TABS} activeId={activeTab} onChange={(id) => onTabChange(id as RolesManagementTab)} />

            {activeTab === 'roles' ? (
                <RolesAndPermissionsTab
                    isEmpty={isEmpty}
                    roles={roles}
                    matrix={matrix}
                    onCreateRole={onCreateRole}
                    onRenameRole={onRenameRole}
                    onDeleteRole={onDeleteRole}
                    onTogglePermission={onTogglePermission}
                    onSavePermissions={onSavePermissions}
                    isCreatingRole={isCreatingRole}
                    isSavingPermissions={isSavingPermissions}
                />
            ) : (
                <EmployeeRoleAssignment employees={employees} roles={roles} onAssign={onAssignRole} onRevoke={onRevokeRole} />
            )}
        </main>
    )
}

export { RolesManagementBody }
