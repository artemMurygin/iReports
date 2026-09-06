import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { RolesAndPermissionsTab } from './RolesAndPermissionsTab.tsx'

/**
 * add-bitrix24-auth-and-rbac, раздел 20 tasks.md (20.3-20.4); ui-design.md — пустое состояние
 * `uRNsj` рендерится ВМЕСТО списка ролей и матрицы прав целиком (не только списка ролей), когда
 * `useRoles().roles` пуст. Ветвление живёт в этом презентационном компоненте (frontend/CLAUDE.md,
 * мediator-конвенция), не в `mediator/RolesManagementPage` — тот только передаёт `isEmpty`.
 */
function noop() {}

describe('RolesAndPermissionsTab', () => {
    it('рендерит пустое состояние вместо списка ролей и матрицы, когда ролей нет', () => {
        render(
            <RolesAndPermissionsTab
                isEmpty
                roles={[]}
                matrix={[]}
                onCreateRole={noop}
                onRenameRole={noop}
                onDeleteRole={noop}
                onTogglePermission={noop}
                onSavePermissions={noop}
            />,
        )

        expect(screen.getByText('Пока нет ни одной роли')).toBeInTheDocument()
        expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('рендерит список ролей и матрицу прав, когда роли есть', () => {
        render(
            <RolesAndPermissionsTab
                isEmpty={false}
                roles={[
                    {
                        id: 'role-admin',
                        name: 'Администратор',
                        isSystem: true,
                        permissionCodes: ['roles:manage'],
                        createdAt: new Date('2026-01-01'),
                        updatedAt: new Date('2026-01-01'),
                    },
                ]}
                matrix={[
                    {
                        roleId: 'role-admin',
                        roleName: 'Администратор',
                        isSystem: true,
                        permissions: [
                            { code: 'roles:manage', label: 'Управление ролями', group: 'Роли и права', checked: true },
                        ],
                    },
                ]}
                onCreateRole={noop}
                onRenameRole={noop}
                onDeleteRole={noop}
                onTogglePermission={noop}
                onSavePermissions={noop}
            />,
        )

        expect(screen.queryByText('Пока нет ни одной роли')).not.toBeInTheDocument()
        expect(screen.getAllByText('Администратор').length).toBeGreaterThan(0)
        expect(screen.getByRole('table')).toBeInTheDocument()
    })

    it('CTA пустого состояния вызывает onCreateRole', () => {
        const onCreateRole = vi.fn()
        render(
            <RolesAndPermissionsTab
                isEmpty
                roles={[]}
                matrix={[]}
                onCreateRole={onCreateRole}
                onRenameRole={noop}
                onDeleteRole={noop}
                onTogglePermission={noop}
                onSavePermissions={noop}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Создать роль' }))
        expect(screen.getByRole('dialog', { name: 'Новая роль' })).toBeInTheDocument()
    })
})
