import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ListPermissionsCatalogResponse, RoleResponse } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { useRolePermissionsMatrix } from './useRolePermissionsMatrix.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 19 tasks.md; architecture.md
 * `useRolePermissionsMatrix`: "query + мутация" -> `{ matrix,
 * togglePermission, save, isSaving }`. Каталог прав — read-only (spec:
 * roles#permission-catalog-from-code), `save` шлёт ВЕСЬ набор permissions
 * роли разом (spec: roles#immediate-permission-changes, `PATCH
 * /roles/:id/permissions`), не один код.
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const ROLE: RoleResponse = {
    id: 'role-1',
    name: 'Бухгалтер',
    isSystem: false,
    permissionCodes: ['reports:view'],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
}

const CATALOG: ListPermissionsCatalogResponse = [
    { code: 'reports:view', label: 'Просмотр отчётов', group: 'Отчёты' },
    { code: 'reports:edit', label: 'Редактирование отчётов', group: 'Отчёты' },
    { code: 'roles:manage', label: 'Управление ролями', group: 'Администрирование' },
]

function renderMatrix() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useRolePermissionsMatrix(), { wrapper })
}

function mockReads() {
    vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
        if (url === '/v1/roles') return Promise.resolve({ data: [ROLE] })
        if (url === '/v1/roles/permissions') return Promise.resolve({ data: CATALOG })
        throw new Error(`Unexpected GET ${url}`)
    })
}

describe('useRolePermissionsMatrix', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
        vi.mocked(axiosInstance.patch).mockReset()
    })

    it('строит матрицу роль×permission из GET /v1/roles и GET /v1/roles/permissions', async () => {
        mockReads()

        const { result } = renderMatrix()
        await waitFor(() => expect(result.current.matrix).toHaveLength(1))

        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/roles', expect.objectContaining({}))
        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/roles/permissions', expect.objectContaining({}))

        const [row] = result.current.matrix
        expect(row.roleId).toBe('role-1')
        expect(row.roleName).toBe('Бухгалтер')
        expect(row.permissions).toEqual([
            { code: 'reports:view', label: 'Просмотр отчётов', group: 'Отчёты', checked: true },
            { code: 'reports:edit', label: 'Редактирование отчётов', group: 'Отчёты', checked: false },
            { code: 'roles:manage', label: 'Управление ролями', group: 'Администрирование', checked: false },
        ])
    })

    it('togglePermission меняет checked локально без сетевого запроса', async () => {
        mockReads()

        const { result } = renderMatrix()
        await waitFor(() => expect(result.current.matrix).toHaveLength(1))

        act(() => {
            result.current.togglePermission('role-1', 'reports:edit')
        })

        await waitFor(() =>
            expect(result.current.matrix[0].permissions.find((p) => p.code === 'reports:edit')?.checked).toBe(true),
        )
        expect(axiosInstance.patch).not.toHaveBeenCalled()
    })

    it('save отправляет PATCH /v1/roles/:id/permissions с полным набором кодов после toggle', async () => {
        mockReads()
        vi.mocked(axiosInstance.patch).mockResolvedValue({
            data: { ...ROLE, permissionCodes: ['reports:view', 'reports:edit'] },
        })

        const { result } = renderMatrix()
        await waitFor(() => expect(result.current.matrix).toHaveLength(1))

        act(() => {
            result.current.togglePermission('role-1', 'reports:edit')
        })
        await waitFor(() =>
            expect(result.current.matrix[0].permissions.find((p) => p.code === 'reports:edit')?.checked).toBe(true),
        )

        await act(async () => {
            await result.current.save('role-1')
        })

        expect(axiosInstance.patch).toHaveBeenCalledWith('/v1/roles/role-1/permissions', {
            permissionCodes: expect.arrayContaining(['reports:view', 'reports:edit']),
        })
    })

    it('isSaving=true, пока запрос save ещё не завершился', async () => {
        mockReads()
        vi.mocked(axiosInstance.patch).mockImplementation(() => new Promise(() => {}))

        const { result } = renderMatrix()
        await waitFor(() => expect(result.current.matrix).toHaveLength(1))

        act(() => {
            result.current.togglePermission('role-1', 'reports:edit')
        })
        await waitFor(() =>
            expect(result.current.matrix[0].permissions.find((p) => p.code === 'reports:edit')?.checked).toBe(true),
        )

        act(() => {
            void result.current.save('role-1')
        })

        await waitFor(() => expect(result.current.isSaving).toBe(true))
    })
})
