import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { RoleResponse } from 'ireports-contracts'

import { RoleList } from './RoleList.tsx'

/**
 * add-bitrix24-auth-and-rbac, раздел 20 tasks.md (20.1); ui-design.md фрейм `s5nMLx` (узел
 * «Roles Bar»); architecture.md `features/RoleManagement/ui/RoleList`: "карточки ролей с CRUD,
 * бейдж «Системная» для `Administrator` без удаления". Ветвление здесь — только
 * `roles.length`/`role.isSystem`, покрытое тестами `useRoles` из раздела 19 (см. 20.1 в
 * tasks.md) — этот тест проверяет только саму вёрстку/колбэки, без мока хука.
 */
const ADMIN_ROLE: RoleResponse = {
    id: 'role-admin',
    name: 'Администратор',
    isSystem: true,
    permissionCodes: ['roles:manage'],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
}

const MANAGER_ROLE: RoleResponse = {
    id: 'role-manager',
    name: 'Руководитель',
    isSystem: false,
    permissionCodes: ['reports:view'],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
}

function noop() {}

describe('RoleList', () => {
    it('показывает бейдж «Системная» и не показывает переименование/удаление для системной роли', () => {
        render(<RoleList roles={[ADMIN_ROLE]} onCreate={noop} onRename={noop} onDelete={noop} />)

        expect(screen.getByText('Администратор')).toBeInTheDocument()
        expect(screen.getByText('Системная')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Переименовать роль Администратор' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Удалить роль Администратор' })).not.toBeInTheDocument()
    })

    it('показывает переименование/удаление для несистемной роли', () => {
        render(<RoleList roles={[MANAGER_ROLE]} onCreate={noop} onRename={noop} onDelete={noop} />)

        expect(screen.getByRole('button', { name: 'Переименовать роль Руководитель' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Удалить роль Руководитель' })).toBeInTheDocument()
        expect(screen.queryByText('Системная')).not.toBeInTheDocument()
    })

    it('удаление роли вызывает onDelete с id роли', () => {
        const onDelete = vi.fn()
        render(<RoleList roles={[MANAGER_ROLE]} onCreate={noop} onRename={noop} onDelete={onDelete} />)

        fireEvent.click(screen.getByRole('button', { name: 'Удалить роль Руководитель' }))

        expect(onDelete).toHaveBeenCalledWith('role-manager')
    })

    it('переименование роли: клик по иконке открывает поле ввода, Enter вызывает onRename с новым именем', () => {
        const onRename = vi.fn()
        render(<RoleList roles={[MANAGER_ROLE]} onCreate={noop} onRename={onRename} onDelete={noop} />)

        fireEvent.click(screen.getByRole('button', { name: 'Переименовать роль Руководитель' }))
        const input = screen.getByDisplayValue('Руководитель')
        fireEvent.change(input, { target: { value: 'Старший руководитель' } })
        fireEvent.keyDown(input, { key: 'Enter' })

        expect(onRename).toHaveBeenCalledWith('role-manager', 'Старший руководитель')
    })

    it('пустой список ролей не рендерит ни одной карточки', () => {
        render(<RoleList roles={[]} onCreate={noop} onRename={noop} onDelete={noop} />)

        expect(screen.queryByText('Администратор')).not.toBeInTheDocument()
    })

    it('кнопка «Добавить роль» открывает модалку создания роли', () => {
        render(<RoleList roles={[]} onCreate={noop} onRename={noop} onDelete={noop} />)

        fireEvent.click(screen.getByRole('button', { name: 'Добавить роль' }))

        expect(screen.getByRole('dialog', { name: 'Новая роль' })).toBeInTheDocument()
    })
})
