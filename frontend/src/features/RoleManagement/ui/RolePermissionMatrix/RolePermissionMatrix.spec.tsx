import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

import type { PermissionMatrixRole } from '../../model/useRolePermissionsMatrix.ts'

import { RolePermissionMatrix } from './RolePermissionMatrix.tsx'

/**
 * add-bitrix24-auth-and-rbac, раздел 20 tasks.md (20.2); ui-design.md фрейм `s5nMLx`, узел
 * «Permission Matrix» (`dEJpT`): роли-колонки × права-строки с группировкой по `group`, чекбоксы.
 * `matrix`/`onToggle` — форма данных `useRolePermissionsMatrix` (раздел 19 tasks.md), уже
 * покрытая тестами хука; здесь проверяется только вёрстка и проброс колбэков.
 */
const MATRIX: PermissionMatrixRole[] = [
    {
        roleId: 'role-admin',
        roleName: 'Администратор',
        isSystem: true,
        permissions: [
            { code: 'employees:view', label: 'Просмотр списка сотрудников', group: 'Сотрудники', checked: true },
            { code: 'roles:manage', label: 'Управление ролями и правами', group: 'Роли и права', checked: true },
        ],
    },
    {
        roleId: 'role-manager',
        roleName: 'Руководитель',
        isSystem: false,
        permissions: [
            { code: 'employees:view', label: 'Просмотр списка сотрудников', group: 'Сотрудники', checked: false },
            { code: 'roles:manage', label: 'Управление ролями и правами', group: 'Роли и права', checked: false },
        ],
    },
]

describe('RolePermissionMatrix', () => {
    it('рендерит группы прав, коды прав и колонки ролей', () => {
        render(<RolePermissionMatrix matrix={MATRIX} onToggle={vi.fn()} onSave={vi.fn()} />)

        expect(screen.getByText('Сотрудники')).toBeInTheDocument()
        expect(screen.getByText('Роли и права')).toBeInTheDocument()
        expect(screen.getByText('Просмотр списка сотрудников')).toBeInTheDocument()
        expect(screen.getByText('employees:view')).toBeInTheDocument()
        expect(screen.getByText('Администратор')).toBeInTheDocument()
        expect(screen.getByText('Руководитель')).toBeInTheDocument()
    })

    it('отражает checked-состояние чекбокса по ячейке матрицы', () => {
        render(<RolePermissionMatrix matrix={MATRIX} onToggle={vi.fn()} onSave={vi.fn()} />)

        const row = screen.getByText('employees:view').closest('[data-slot="matrix-row"]') as HTMLElement
        const checkboxes = within(row).getAllByRole('checkbox')
        expect(checkboxes[0]).toHaveAttribute('data-state', 'checked')
        expect(checkboxes[1]).toHaveAttribute('data-state', 'unchecked')
    })

    it('клик по чекбоксу вызывает onToggle с roleId и кодом права', () => {
        const onToggle = vi.fn()
        render(<RolePermissionMatrix matrix={MATRIX} onToggle={onToggle} onSave={vi.fn()} />)

        const row = screen.getByText('employees:view').closest('[data-slot="matrix-row"]') as HTMLElement
        const checkboxes = within(row).getAllByRole('checkbox')
        fireEvent.click(checkboxes[1])

        expect(onToggle).toHaveBeenCalledWith('role-manager', 'employees:view')
    })

    it('кнопка «Сохранить» колонки роли вызывает onSave с roleId этой роли', () => {
        const onSave = vi.fn()
        render(<RolePermissionMatrix matrix={MATRIX} onToggle={vi.fn()} onSave={onSave} />)

        fireEvent.click(screen.getByRole('button', { name: 'Сохранить права роли Руководитель' }))

        expect(onSave).toHaveBeenCalledWith('role-manager')
    })

    it('без ролей не рендерит строк матрицы', () => {
        render(<RolePermissionMatrix matrix={[]} onToggle={vi.fn()} onSave={vi.fn()} />)

        expect(screen.queryByText('Право доступа')).not.toBeInTheDocument()
    })
})
