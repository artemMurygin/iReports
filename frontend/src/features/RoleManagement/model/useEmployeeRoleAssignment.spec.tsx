import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ListEmployeesResponse } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { useEmployeeRoleAssignment } from './useEmployeeRoleAssignment.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 19 tasks.md; architecture.md
 * `useEmployeeRoleAssignment`: "query (существующий `/directory/employees`)
 * + мутации ролей" -> `{ employees, assignRole, revokeRole }`. Список
 * сотрудников — уже существующий справочник `directory`, не отдельный
 * эндпоинт `roles` (design.md Decision 1).
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

const EMPLOYEES: ListEmployeesResponse = [
    { id: 7, name: 'Иван Иванов', departmentId: 1 },
    { id: 8, name: 'Елена Соколова', departmentId: 1 },
]

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

    it('загружает список сотрудников через GET /v1/directory/employees', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: EMPLOYEES })

        const { result } = renderAssignment()
        await waitFor(() => expect(result.current.employees).toEqual(EMPLOYEES))

        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/directory/employees', expect.objectContaining({}))
    })

    it('assignRole вызывает POST /v1/roles/:roleId/employees/:employeeId', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: EMPLOYEES })
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: undefined })

        const { result } = renderAssignment()
        await waitFor(() => expect(result.current.employees).toEqual(EMPLOYEES))

        await act(async () => {
            await result.current.assignRole(7, 'role-1')
        })

        expect(axiosInstance.post).toHaveBeenCalledWith('/v1/roles/role-1/employees/7')
    })

    it('revokeRole вызывает DELETE /v1/roles/:roleId/employees/:employeeId', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: EMPLOYEES })
        vi.mocked(axiosInstance.delete).mockResolvedValue({ data: undefined })

        const { result } = renderAssignment()
        await waitFor(() => expect(result.current.employees).toEqual(EMPLOYEES))

        await act(async () => {
            await result.current.revokeRole(7, 'role-1')
        })

        expect(axiosInstance.delete).toHaveBeenCalledWith('/v1/roles/role-1/employees/7')
    })
})
