import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AuthMeResponse } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { useAuthStore } from './authStore.ts'
import { useCurrentUser } from './useCurrentUser.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 16 tasks.md — `useCurrentUser` дергает
 * `GET /v1/auth/me` (тем же query-ключом `auth-me`, что и
 * `app/route-guard/model/session.api.ts`, раздел 15 — см. WHY в api.ts этой
 * фичи) и параллельно кладёт результат в `authStore`, которым пользуется
 * `useHasPermission`. Отсутствие сессии (401) — ожидаемое состояние, а не
 * ошибка приложения (тот же fail-closed принцип, что и в route-guard).
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn() },
}))

function renderCurrentUser() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useCurrentUser(), { wrapper })
}

describe('useCurrentUser', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
        useAuthStore.setState({ employee: null, permissions: [], status: 'idle' })
    })

    it('isInitialLoad=true, пока ответ /v1/auth/me ещё не пришёл', () => {
        vi.mocked(axiosInstance.get).mockImplementation(() => new Promise(() => {}))

        const { result } = renderCurrentUser()

        expect(result.current.isInitialLoad).toBe(true)
        expect(result.current.employee).toBeNull()
        expect(result.current.permissions).toEqual([])
    })

    it('возвращает employee/permissions из GET /v1/auth/me и синхронизирует их в authStore', async () => {
        const response: AuthMeResponse = {
            employee: { id: 7, firstName: 'Иван', lastName: 'Иванов' },
            permissions: ['reports:view', 'roles:manage'],
        }
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: response })

        const { result } = renderCurrentUser()
        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))

        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/auth/me')
        expect(result.current.employee).toEqual(response.employee)
        expect(result.current.permissions).toEqual(response.permissions)
        expect(useAuthStore.getState().permissions).toEqual(response.permissions)
        expect(useAuthStore.getState().status).toBe('authenticated')
    })

    it('нет подтверждённой сессии (401) — employee null, permissions [], без исключения наружу', async () => {
        vi.mocked(axiosInstance.get).mockRejectedValue({ response: { status: 401 } })

        const { result } = renderCurrentUser()
        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))

        expect(result.current.employee).toBeNull()
        expect(result.current.permissions).toEqual([])
        expect(useAuthStore.getState().status).toBe('unauthenticated')
    })
})
