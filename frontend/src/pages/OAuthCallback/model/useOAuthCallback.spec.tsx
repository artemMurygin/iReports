import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'
import { OAUTH_STATE_STORAGE_KEY } from '@/features/Auth'

import { useOAuthCallback } from './useOAuthCallback.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 23 tasks.md; design.md Decision 13 / specs/auth/spec.md
 * "Защита OAuth-флоу от login-CSRF через сверку `state`" + "Приём OAuth-редиректа на frontend"
 * (spec: auth#oauth-login-csrf-state-protection, auth#oauth-callback-frontend-route). Сверка
 * `state` из URL с сохранённым в `sessionStorage` значением должна произойти ДО отправки `code`
 * на backend, а сохранённое значение — быть удалено сразу после однократной сверки независимо от
 * результата (используется `consumeStoredOAuthState()`, читающий и удаляющий значение одним
 * вызовом — см. `features/Auth/model/oauthState.ts`).
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn() },
}))

function renderCallback(url: string) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
            </QueryClientProvider>
        )
    }
    return renderHook(() => useOAuthCallback(), { wrapper })
}

describe('useOAuthCallback', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.post).mockReset()
        sessionStorage.clear()
    })

    it('при совпадении state отправляет code на POST /v1/auth/oauth/callback и удаляет сохранённое значение', async () => {
        sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, 'expected-state')
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: { success: true } })

        renderCallback('/auth/callback?code=auth-code&state=expected-state')

        await waitFor(() =>
            expect(axiosInstance.post).toHaveBeenCalledWith('/v1/auth/oauth/callback', {
                code: 'auth-code',
                state: 'expected-state',
            }),
        )
        expect(sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY)).toBeNull()
    })

    it('при несовпадении state не отправляет code, переводит статус в error и удаляет сохранённое значение (одноразовое использование)', async () => {
        sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, 'stored-state')

        const { result } = renderCallback('/auth/callback?code=auth-code&state=different-state')

        await waitFor(() => expect(result.current.status).toBe('error'))
        expect(axiosInstance.post).not.toHaveBeenCalled()
        expect(sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY)).toBeNull()
    })

    it('при отсутствии сохранённого state не отправляет code, переводит статус в error и не выполняет лишнее удаление', async () => {
        const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem')

        const { result } = renderCallback('/auth/callback?code=auth-code&state=whatever')

        await waitFor(() => expect(result.current.status).toBe('error'))
        expect(axiosInstance.post).not.toHaveBeenCalled()
        // единственный вызов — внутри consumeStoredOAuthState (сверка + удаление одним действием),
        // без дополнительного removeItem в ветке ошибки.
        expect(removeItemSpy).toHaveBeenCalledTimes(1)

        removeItemSpy.mockRestore()
    })

    it('при отсутствии code в URL не отправляет запрос и переводит статус в error', async () => {
        sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, 'expected-state')

        const { result } = renderCallback('/auth/callback?state=expected-state')

        await waitFor(() => expect(result.current.status).toBe('error'))
        expect(axiosInstance.post).not.toHaveBeenCalled()
    })
})
