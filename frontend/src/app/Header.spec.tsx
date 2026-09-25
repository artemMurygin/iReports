import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { AuthMeResponse } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'
import { useAuthStore } from '@/features/Auth'

import { Header } from './Header.tsx'

/**
 * add-frontend-page-access-guard, раздел 6 tasks.md — `Header.tsx` применяет
 * `filterNavItemsByPermission` (раздел 3) к `navItems`/`subnavTabs`-источнику/`drawerSections`
 * (`TOP_LEVEL_NAV_ITEMS`/`activeSection.items`/`DRAWER_SECTIONS`, `app/navigation.tsx`) до
 * вычисления `active` — пункт, на `requiredPermission` которого у пользователя нет ни одного
 * совпадения, не должен попасть в финальный список, уходящий в `UiKitHeader` (ни в Nav Bar, ни в
 * Drawer, ни в Subnav).
 *
 * Тот же приём мока сессии, что и `app/route-guard/ui/RouteGuard.spec.tsx`: мокается
 * `@/shared/api/axios.instance.ts` (`GET /v1/auth/me`), а `useAuthStore` наполняется и напрямую
 * (`setAuthenticated`), и через ответ мока — `Header` читает пользователя через `useCurrentUser`
 * (её `employee`/`permissions` идут из результата запроса, а не только из стора), которая
 * синхронизирует `authStore` побочным эффектом уже после разрешения запроса.
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn() },
}))

function mockSession(response: AuthMeResponse) {
    vi.mocked(axiosInstance.get).mockResolvedValue({ data: response })
    useAuthStore.getState().setAuthenticated(response)
}

function session(permissions: string[]): AuthMeResponse {
    return {
        employee: { id: 1, firstName: 'Иван', lastName: 'Иванов' },
        permissions,
    }
}

function renderHeader(permissions: string[], initialEntry = '/') {
    mockSession(session(permissions))
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[initialEntry]}>
                <Header />
            </MemoryRouter>
        </QueryClientProvider>,
    )
}

describe('Header', () => {
    afterEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
        useAuthStore.setState({ employee: null, permissions: [], status: 'idle' })
    })

    it('не рендерит пункт «Задачи» в Nav Bar и в Drawer у пользователя без tasks:view', async () => {
        renderHeader(['reports:view'])

        // Дожидаемся, пока сессия разрешится и попадёт в шапку (имя пользователя рендерится
        // только из результата запроса, а не из статических данных) — якорь, не зависящий ни от
        // одного из проверяемых permissions.
        await screen.findAllByText('Иван Иванов')

        const navBar = document.querySelector('[data-slot="nav-bar"]') as HTMLElement
        const drawer = document.querySelector('[data-slot="nav-drawer"]') as HTMLElement
        expect(within(navBar).queryByText('Задачи')).not.toBeInTheDocument()
        expect(within(drawer).queryByText('Задачи')).not.toBeInTheDocument()
    })

    it('рендерит пункт «Задачи» в Nav Bar и в Drawer у пользователя с tasks:view', async () => {
        renderHeader(['tasks:view'])

        await screen.findAllByText('Иван Иванов')

        const navBar = document.querySelector('[data-slot="nav-bar"]') as HTMLElement
        const drawer = document.querySelector('[data-slot="nav-drawer"]') as HTMLElement
        expect(within(navBar).getByText('Задачи')).toBeInTheDocument()
        expect(within(drawer).getByText('Задачи')).toBeInTheDocument()
    })

    it('не рендерит вкладку «Правила начисления» в Subnav раздела «Зарплата» без service-accounting:view/shop-accounting:view, но оставляет «Отчёт по зарплате»', async () => {
        renderHeader(['service-accounting:view_all_salary_report'], '/salaries')

        await screen.findAllByText('Иван Иванов')

        const subnav = document.querySelector('[data-slot="subnav"]') as HTMLElement
        expect(subnav).not.toBeNull()
        expect(within(subnav).getByText('Отчёт по зарплате')).toBeInTheDocument()
        expect(within(subnav).queryByText('Правила начисления')).not.toBeInTheDocument()
    })
})
