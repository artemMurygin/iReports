import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { AuthMeResponse } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { RouteGuard } from './RouteGuard.tsx'

/**
 * add-bitrix24-auth-and-rbac, раздел 15 tasks.md — обёртка вокруг роутов
 * рендерит `pages/Login` в standalone-контексте без валидной сессии и
 * `pages/AccessDenied` при отсутствии нужного permission у защищённого
 * роута (объявляется через `handle.requiredPermission`, см. `useRouteGuardState.ts`).
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn() },
}))

function mockSession(response: AuthMeResponse | 'unauthenticated') {
    vi.mocked(axiosInstance.get).mockImplementation(() => {
        if (response === 'unauthenticated') {
            return Promise.reject({ response: { status: 401 } })
        }
        return Promise.resolve({ data: response })
    })
}

function enterIframeContext() {
    Object.defineProperty(window, 'top', { value: {}, configurable: true })
    // Этому тесту важно только присутствие window.BX24 (наличие SDK) — реальные
    // init/getAuth не вызываются здесь, поэтому достаточно минимальной заглушки.
    window.BX24 = { init: () => {}, getAuth: () => false }
}

const AUTHENTICATED: AuthMeResponse = {
    employee: { id: 1, firstName: 'Иван', lastName: 'Иванов' },
    permissions: ['reports:view'],
}

function renderGuardedRoute(options: { requiredPermission?: string } = {}) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createMemoryRouter([
        {
            path: '/',
            element: (
                <RouteGuard>
                    <div>Protected content</div>
                </RouteGuard>
            ),
            handle: options.requiredPermission ? { requiredPermission: options.requiredPermission } : undefined,
        },
    ])

    return render(
        <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
        </QueryClientProvider>,
    )
}

describe('RouteGuard', () => {
    afterEach(() => {
        // @ts-expect-error — сбрасываем то, что тест мог подменить на window.top/window.BX24.
        delete window.top
        window.top = window
        delete window.BX24
        vi.mocked(axiosInstance.get).mockReset()
    })

    it('рендерит pages/Login в standalone-контексте без валидной сессии', async () => {
        mockSession('unauthenticated')

        renderGuardedRoute()

        expect(await screen.findByText('Войдите через Bitrix24')).toBeInTheDocument()
        expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    })

    it('рендерит защищённый контент в standalone-контексте с валидной сессией и без требования permission', async () => {
        mockSession(AUTHENTICATED)

        renderGuardedRoute()

        expect(await screen.findByText('Protected content')).toBeInTheDocument()
    })

    it('рендерит pages/AccessDenied, когда у роута есть requiredPermission, а у пользователя его нет', async () => {
        mockSession(AUTHENTICATED)

        renderGuardedRoute({ requiredPermission: 'roles:manage' })

        expect(await screen.findByRole('alert')).toBeInTheDocument()
        expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    })

    it('рендерит защищённый контент, когда у пользователя есть требуемый permission', async () => {
        mockSession(AUTHENTICATED)

        renderGuardedRoute({ requiredPermission: 'reports:view' })

        expect(await screen.findByText('Protected content')).toBeInTheDocument()
    })

    it('не рендерит pages/Login в iframe-контексте без валидной сессии (см. architecture.md — Login не для embedded)', async () => {
        enterIframeContext()
        mockSession('unauthenticated')

        renderGuardedRoute()

        await waitFor(() => expect(axiosInstance.get).toHaveBeenCalled())
        expect(await screen.findByText('Protected content')).toBeInTheDocument()
        expect(screen.queryByText('Войдите через Bitrix24')).not.toBeInTheDocument()
    })

    it('в iframe-контексте всё равно применяет проверку requiredPermission', async () => {
        enterIframeContext()
        mockSession(AUTHENTICATED)

        renderGuardedRoute({ requiredPermission: 'roles:manage' })

        expect(await screen.findByRole('alert')).toBeInTheDocument()
    })
})
