import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { AUTH_ME_QUERY_KEY } from './api.ts'
import { useAuthStore } from './authStore.ts'
import { useLogout } from './useLogout.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 16 tasks.md — `useLogout` дергает
 * `POST /v1/auth/logout` (spec: session#logout-deletes-session-server-side)
 * и после успеха сбрасывает и `authStore`, и закэшированный `auth-me`
 * (`AUTH_ME_QUERY_KEY`), чтобы `useHasPermission`/`useCurrentUser` сразу
 * отражали разлогин без ожидания фонового рефетча.
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn() },
}))

function renderLogout(queryClient: QueryClient) {
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useLogout(), { wrapper })
}

describe('useLogout', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.post).mockReset()
        useAuthStore.setState({
            employee: { id: 1, firstName: 'Иван', lastName: 'Иванов' },
            permissions: ['reports:view'],
            status: 'authenticated',
        })
    })

    it('POST /v1/auth/logout и сбрасывает authStore/кэш auth-me после успеха', async () => {
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: { success: true } })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        queryClient.setQueryData(AUTH_ME_QUERY_KEY, {
            employee: { id: 1, firstName: 'Иван', lastName: 'Иванов' },
            permissions: ['reports:view'],
        })

        const { result } = renderLogout(queryClient)
        act(() => {
            result.current.logout()
        })

        await waitFor(() => expect(result.current.isPending).toBe(false))

        expect(axiosInstance.post).toHaveBeenCalledWith('/v1/auth/logout')
        expect(useAuthStore.getState().status).toBe('unauthenticated')
        expect(useAuthStore.getState().employee).toBeNull()
        expect(useAuthStore.getState().permissions).toEqual([])
        expect(queryClient.getQueryData(AUTH_ME_QUERY_KEY)).toBeNull()
    })

    it('isPending=true, пока запрос logout ещё не завершился', async () => {
        vi.mocked(axiosInstance.post).mockImplementation(() => new Promise(() => {}))
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

        const { result } = renderLogout(queryClient)
        act(() => {
            result.current.logout()
        })

        await waitFor(() => expect(result.current.isPending).toBe(true))
    })
})
