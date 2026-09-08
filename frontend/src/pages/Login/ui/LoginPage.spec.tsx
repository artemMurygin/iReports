import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { LoginPage } from './LoginPage.tsx'

/**
 * add-bitrix24-auth-and-rbac, раздел 18 tasks.md — `pages/Login` рендерится
 * `app/route-guard/ui/RouteGuard.tsx` в standalone/iOS-контексте без валидной сессии (раздел 15
 * tasks.md). Клик по CTA `pages/Login/ui/LoginGate` должен вызвать `useBitrixLogin().login()`
 * (раздел 16 tasks.md) — сам редирект (`window.location.assign`) уже покрыт
 * `features/Auth/model/useBitrixLogin.spec.ts`, здесь проверяется только подключение хука к
 * кнопке.
 */
const loginMock = vi.fn()

vi.mock('@/features/Auth', () => ({
    useBitrixLogin: () => ({ login: loginMock }),
}))

describe('LoginPage', () => {
    it('клик по кнопке CTA вызывает useBitrixLogin().login()', async () => {
        const user = userEvent.setup()
        render(<LoginPage />)

        await user.click(screen.getByRole('button', { name: 'Войти через Bitrix24' }))

        expect(loginMock).toHaveBeenCalledTimes(1)
    })
})
