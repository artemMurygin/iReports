import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useBitrixLogin } from './useBitrixLogin.ts'
import { OAUTH_STATE_STORAGE_KEY } from './oauthState.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 16 tasks.md; architecture.md `useBitrixLogin`:
 * "обычный хук (без запроса — формирует URL и делает redirect)" -> "генерирует `state`, сохраняет
 * в `sessionStorage` (design.md Decision 13), редиректит на `{portal}/oauth/authorize/`" (spec:
 * auth#oauth-authorization-code-flow, auth#oauth-login-csrf-state-protection). Домен портала
 * захардкожен (design.md — приложение single-tenant, тот же приём, что
 * `BitrixAuthService.saveInstallation` на backend).
 *
 * ОТКРЫТЫЙ ВОПРОС (не решался самостоятельно, см. финальный отчёт раздела 16): ни
 * proposal.md/specs/design.md/architecture.md не описывают `client_id`/`redirect_uri` —
 * реализация ниже добавляет только `state` (раздел 23 tasks.md, design.md Decision 13), не
 * домысливая остальные параметры редиректа.
 */
describe('useBitrixLogin', () => {
    beforeEach(() => {
        sessionStorage.clear()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        sessionStorage.clear()
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

    // spec: auth#oauth-login-csrf-state-protection — state генерируется перед редиректом,
    // сохраняется в sessionStorage и передаётся тем же значением в query-параметре `state`,
    // чтобы страница приёма callback (раздел 23) могла сверить их до отправки code на backend.
    it('login() генерирует state, сохраняет его в sessionStorage и включает то же значение в query-параметр state редиректа', () => {
        const { assignSpy, restore } = stubLocationAssign()

        const { result } = renderHook(() => useBitrixLogin())
        result.current.login()

        const redirectUrl = new URL(assignSpy.mock.calls[0]?.[0] as string)
        const stateParam = redirectUrl.searchParams.get('state')

        expect(stateParam).toBeTruthy()
        expect(sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY)).toBe(stateParam)

        restore()
    })

    it('login() генерирует новый случайный state при каждом вызове', () => {
        const first = stubLocationAssign()
        const { result } = renderHook(() => useBitrixLogin())
        result.current.login()
        const firstState = new URL(first.assignSpy.mock.calls[0]?.[0] as string).searchParams.get('state')
        first.restore()

        const second = stubLocationAssign()
        result.current.login()
        const secondState = new URL(second.assignSpy.mock.calls[0]?.[0] as string).searchParams.get('state')
        second.restore()

        expect(firstState).not.toBe(secondState)
    })
})
