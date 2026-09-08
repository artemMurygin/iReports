import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RoleResponse } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { useRoles } from './useRoles.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 19 tasks.md; architecture.md
 * `useRoles`: "query + мутации CRUD" -> `{ roles, createRole, renameRole,
 * deleteRole }`. spec: roles#model-role-permission — CRUD ролей доступен
 * через API без деплоя.
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

function renderRoles() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useRoles(), { wrapper })
}

describe('useRoles', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
        vi.mocked(axiosInstance.post).mockReset()
        vi.mocked(axiosInstance.patch).mockReset()
        vi.mocked(axiosInstance.delete).mockReset()
    })

    it('загружает список ролей через GET /v1/roles', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: [ROLE] })

        const { result } = renderRoles()
        await waitFor(() => expect(result.current.roles).toEqual([ROLE]))

        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/roles', expect.objectContaining({}))
    })

    it('createRole вызывает POST /v1/roles с name/permissionCodes и обновляет список', async () => {
        vi.mocked(axiosInstance.get)
            .mockResolvedValueOnce({ data: [] })
            .mockResolvedValueOnce({ data: [ROLE] })
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: ROLE })

        const { result } = renderRoles()
        await waitFor(() => expect(result.current.roles).toEqual([]))

        await act(async () => {
            await result.current.createRole('Бухгалтер', ['reports:view'])
        })

        expect(axiosInstance.post).toHaveBeenCalledWith('/v1/roles', {
            name: 'Бухгалтер',
            permissionCodes: ['reports:view'],
        })
        await waitFor(() => expect(result.current.roles).toEqual([ROLE]))
    })

    it('renameRole вызывает PATCH /v1/roles/:id с новым именем', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: [ROLE] })
        vi.mocked(axiosInstance.patch).mockResolvedValue({ data: { ...ROLE, name: 'Гл. бухгалтер' } })

        const { result } = renderRoles()
        await waitFor(() => expect(result.current.roles).toEqual([ROLE]))

        await act(async () => {
            await result.current.renameRole('role-1', 'Гл. бухгалтер')
        })

        expect(axiosInstance.patch).toHaveBeenCalledWith('/v1/roles/role-1', { name: 'Гл. бухгалтер' })
    })

    it('deleteRole вызывает DELETE /v1/roles/:id', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: [ROLE] })
        vi.mocked(axiosInstance.delete).mockResolvedValue({ data: undefined })

        const { result } = renderRoles()
        await waitFor(() => expect(result.current.roles).toEqual([ROLE]))

        await act(async () => {
            await result.current.deleteRole('role-1')
        })

        expect(axiosInstance.delete).toHaveBeenCalledWith('/v1/roles/role-1')
    })
})
