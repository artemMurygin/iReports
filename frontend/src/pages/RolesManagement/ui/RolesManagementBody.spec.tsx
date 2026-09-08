import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { RolesManagementBody } from './RolesManagementBody.tsx'

/**
 * add-bitrix24-auth-and-rbac, раздел 20.8 tasks.md; ui-design.md `s5nMLx`/`F6d3a` — переключение
 * вкладок «Роли и права»/«Сотрудники». Ветвление "какую вкладку показать" живёт здесь (не в
 * `mediator/RolesManagementPage`, frontend/CLAUDE.md — «медиатор не должен содержать условного
 * рендера»), тем же приёмом, что и `isEmpty`-ветвление в `RolesAndPermissionsTab`.
 */
function noop() {}

const BASE_PROPS = {
    isEmpty: false,
    roles: [
        {
            id: 'role-admin',
            name: 'Администратор',
            isSystem: true,
            permissionCodes: ['roles:manage'],
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
        },
    ],
    matrix: [
        {
            roleId: 'role-admin',
            roleName: 'Администратор',
            isSystem: true,
            permissions: [{ code: 'roles:manage', label: 'Управление ролями', group: 'Роли и права', checked: true }],
        },
    ],
    onCreateRole: noop,
    onRenameRole: noop,
    onDeleteRole: noop,
    onTogglePermission: noop,
    onSavePermissions: noop,
    employees: [{ id: 7, name: 'Иван Иванов', departmentId: 1, departmentName: 'Сервис', roleIds: ['role-admin'] }],
    onAssignRole: noop,
    onRevokeRole: noop,
}

describe('RolesManagementBody', () => {
    it('на вкладке "Роли и права" рендерит RolesAndPermissionsTab, не таблицу сотрудников', () => {
        render(<RolesManagementBody activeTab="roles" onTabChange={noop} {...BASE_PROPS} />)

        expect(screen.getByRole('table')).toBeInTheDocument()
        expect(screen.queryByText('Иван Иванов')).not.toBeInTheDocument()
    })

    it('на вкладке "Сотрудники" рендерит EmployeeRoleAssignment, не список/матрицу ролей', () => {
        render(<RolesManagementBody activeTab="employees" onTabChange={noop} {...BASE_PROPS} />)

        expect(screen.getByText('Иван Иванов')).toBeInTheDocument()
        expect(screen.queryByText('Добавить роль')).not.toBeInTheDocument()
    })

    it('клик по вкладке "Сотрудники" вызывает onTabChange', () => {
        const onTabChange = vi.fn()
        render(<RolesManagementBody activeTab="roles" onTabChange={onTabChange} {...BASE_PROPS} />)

        fireEvent.click(screen.getByRole('tab', { name: 'Сотрудники' }))

        expect(onTabChange).toHaveBeenCalledWith('employees')
    })
})
