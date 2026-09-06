import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { RoleResponse } from 'ireports-contracts'

import type { EmployeeWithRoles } from '../../model/useEmployeeRoleAssignment.ts'

import { EmployeeRoleAssignment } from './EmployeeRoleAssignment.tsx'

/**
 * add-bitrix24-auth-and-rbac, раздел 20.7 tasks.md; ui-design.md фрейм `F6d3a`: таблица
 * сотрудников с бейджами ролей и состоянием «Роль не назначена» (иконка `user-plus` вместо
 * `pencil` в колонке действий — вариант ячейки на строке «Елена Соколова»/`C2s69` в макете).
 *
 * `employees`/`roles` — форма данных `useEmployeeRoleAssignment` (раздел 19+20.7), уже покрытая
 * тестами хука; здесь проверяется только вёрстка и проброс `onAssign`/`onRevoke`.
 */
const ROLES: RoleResponse[] = [
    {
        id: 'role-admin',
        name: 'Администратор',
        isSystem: true,
        permissionCodes: [],
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
    },
    {
        id: 'role-manager',
        name: 'Руководитель',
        isSystem: false,
        permissionCodes: [],
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
    },
]

const EMPLOYEES: EmployeeWithRoles[] = [
    { id: 7, name: 'Иван Иванов', departmentId: 1, departmentName: 'Сервис', roleIds: ['role-admin'] },
    { id: 8, name: 'Елена Соколова', departmentId: 1, departmentName: 'Сервис', roleIds: [] },
]

function renderTable(onAssign = vi.fn(), onRevoke = vi.fn()) {
    return render(<EmployeeRoleAssignment employees={EMPLOYEES} roles={ROLES} onAssign={onAssign} onRevoke={onRevoke} />)
}

describe('EmployeeRoleAssignment', () => {
    it('рендерит сотрудника, отдел и бейдж назначенной роли', () => {
        renderTable()

        expect(screen.getByText('Иван Иванов')).toBeInTheDocument()
        expect(screen.getAllByText('Сервис').length).toBe(2)
        expect(screen.getByText('Администратор')).toBeInTheDocument()
    })

    it('показывает «Роль не назначена» и иконку user-plus вместо pencil для сотрудника без роли', () => {
        renderTable()

        expect(screen.getByText('Роль не назначена')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Назначить роль сотруднику Елена Соколова' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Изменить роли сотрудника Иван Иванов' })).toBeInTheDocument()
    })

    it('вызывает onAssign при выборе роли в поповере назначения не назначенному сотруднику', () => {
        const onAssign = vi.fn()
        renderTable(onAssign)

        fireEvent.click(screen.getByRole('button', { name: 'Назначить роль сотруднику Елена Соколова' }))
        fireEvent.click(screen.getByRole('checkbox', { name: 'Администратор' }))

        expect(onAssign).toHaveBeenCalledWith(8, 'role-admin')
    })

    it('вызывает onRevoke при снятии уже отмеченной роли в поповере', () => {
        const onRevoke = vi.fn()
        renderTable(vi.fn(), onRevoke)

        fireEvent.click(screen.getByRole('button', { name: 'Изменить роли сотрудника Иван Иванов' }))
        fireEvent.click(screen.getByRole('checkbox', { name: 'Администратор' }))

        expect(onRevoke).toHaveBeenCalledWith(7, 'role-admin')
    })
})
