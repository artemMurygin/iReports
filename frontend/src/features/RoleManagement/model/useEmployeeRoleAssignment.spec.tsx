import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type {
    ListDepartmentsResponse,
    ListEmployeesResponse,
    ListRoleAssignmentsResponse,
    ListRolesResponse,
} from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { useEmployeeRoleAssignment } from './useEmployeeRoleAssignment.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 20.7 tasks.md; architecture.md
 * `useEmployeeRoleAssignment`: "query (существующий `/directory/employees`)
 * + мутации ролей" -> `{ employees, assignRole, revokeRole }`. Список
 * сотрудников — уже существующий справочник `directory`, не отдельный
 * эндпоинт `roles` (design.md Decision 1).
 *
 * Раздел 20.7 расширяет хук данными о ФАКТИЧЕСКОМ назначении ролей
 * (`GET /v1/roles/assignments`, раздел 22) — снимает открытый вопрос раздела 19
 * (см. финальный отчёт раздела 19/комментарий на предыдущей версии этого файла):
 * каждый сотрудник в `employees` теперь несёт свой `roleIds` (пусто — «Роль не
 * назначена», ui-design.md фрейм `F6d3a`), а хук также отдаёт полный список
 * `roles` (для бейджей с названием роли и выбора роли для назначения) и
 * `departmentName` (через уже существующий `GET /directory/departments`,
 * тот же приём, что и `pages/EmployeeIdentity/model/api.ts`'s `getDepartments`).
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const EMPLOYEES: ListEmployeesResponse = [
    { id: 7, name: 'Иван Иванов', departmentId: 1 },
    { id: 8, name: 'Елена Соколова', departmentId: 1 },
]

const ROLES: ListRolesResponse = [
    {
        id: 'role-1',
        name: 'Администратор',
        isSystem: true,
        permissionCodes: ['roles:manage'],
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
    },
]

const ASSIGNMENTS: ListRoleAssignmentsResponse = [{ employeeId: 7, roleIds: ['role-1'] }]

const DEPARTMENTS: ListDepartmentsResponse = [{ id: 1, name: 'Сервис' }]

function mockGetByUrl() {
    vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
        if (url === '/v1/directory/employees') return Promise.resolve({ data: EMPLOYEES })
        if (url === '/v1/roles') return Promise.resolve({ data: ROLES })
        if (url === '/v1/roles/assignments') return Promise.resolve({ data: ASSIGNMENTS })
        if (url === '/v1/directory/departments') return Promise.resolve({ data: DEPARTMENTS })
        return Promise.reject(new Error(`unexpected GET ${url}`))
    })
}

function renderAssignment() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useEmployeeRoleAssignment(), { wrapper })
}

describe('useEmployeeRoleAssignment', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
        vi.mocked(axiosInstance.post).mockReset()
        vi.mocked(axiosInstance.delete).mockReset()
    })

    it('сопоставляет сотрудникам их roleIds (из назначений) и название отдела', async () => {
        mockGetByUrl()

        const { result } = renderAssignment()
        await waitFor(() =>
            expect(result.current.employees).toEqual([
                { id: 7, name: 'Иван Иванов', departmentId: 1, departmentName: 'Сервис', roleIds: ['role-1'] },
                { id: 8, name: 'Елена Соколова', departmentId: 1, departmentName: 'Сервис', roleIds: [] },
            ]),
        )

        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/directory/employees', expect.objectContaining({}))
        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/roles/assignments', expect.objectContaining({}))
        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/directory/departments', expect.objectContaining({}))
    })

    it('отдаёт полный список ролей для бейджей и выбора роли при назначении', async () => {
        mockGetByUrl()

        const { result } = renderAssignment()
        await waitFor(() => expect(result.current.roles).toEqual(ROLES))
    })

    it('assignRole вызывает POST /v1/roles/:roleId/employees/:employeeId', async () => {
        mockGetByUrl()
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: undefined })

        const { result } = renderAssignment()
        await waitFor(() => expect(result.current.employees.length).toBe(2))

        await act(async () => {
            await result.current.assignRole(8, 'role-1')
        })

        expect(axiosInstance.post).toHaveBeenCalledWith('/v1/roles/role-1/employees/8')
    })

    it('revokeRole вызывает DELETE /v1/roles/:roleId/employees/:employeeId', async () => {
        mockGetByUrl()
        vi.mocked(axiosInstance.delete).mockResolvedValue({ data: undefined })

        const { result } = renderAssignment()
        await waitFor(() => expect(result.current.employees.length).toBe(2))

        await act(async () => {
            await result.current.revokeRole(7, 'role-1')
        })

        expect(axiosInstance.delete).toHaveBeenCalledWith('/v1/roles/role-1/employees/7')
    })
})
