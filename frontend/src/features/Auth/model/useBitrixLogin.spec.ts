import { describe, expect, it, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useBitrixLogin } from './useBitrixLogin.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 16 tasks.md; architecture.md `useBitrixLogin`:
 * "обычный хук (без запроса — формирует URL и делает redirect)" -> "редиректит на
 * `{portal}/oauth/authorize/`" (spec: auth#oauth-authorization-code-flow). Домен
 * портала захардкожен (design.md — приложение single-tenant, тот же приём, что
 * `BitrixAuthService.saveInstallation` на backend).
 *
 * ОТКРЫТЫЙ ВОПРОС (не решался самостоятельно, см. финальный отчёт раздела 16):
 * ни proposal.md/specs/design.md/architecture.md не описывают query-параметры
 * реального redirect (`client_id`, `redirect_uri`, `state`) и то, какая
 * страница фронтенда принимает обратный редирект Bitrix24 с `?code=&state=` —
 * ни один раздел tasks.md её не заводит. Тест и реализация ниже сознательно
 * ограничены буквальной формулировкой architecture.md (переход на
 * `{portal}/oauth/authorize/`), без домысливания этих параметров.
 */
describe('useBitrixLogin', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    function stubLocationAssign() {
        const assignSpy = vi.fn()
        const original = window.location
        Object.defineProperty(window, 'location', {
            value: { ...original, assign: assignSpy },
            writable: true,
            configurable: true,
        })
        return {
            assignSpy,
            restore: () => Object.defineProperty(window, 'location', { value: original, writable: true, configurable: true }),
        }
    }

    it('login() редиректит на https://irepair.bitrix24.ru/oauth/authorize/', () => {
        const { assignSpy, restore } = stubLocationAssign()

        const { result } = renderHook(() => useBitrixLogin())
        result.current.login()

        expect(assignSpy).toHaveBeenCalledTimes(1)
        expect(assignSpy.mock.calls[0]?.[0]).toContain('https://irepair.bitrix24.ru/oauth/authorize/')

        restore()
    })
})
