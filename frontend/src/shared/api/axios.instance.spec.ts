import { afterEach, describe, expect, it } from 'vitest'
import { AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'

import { api } from './axios.instance.ts'
import { setSessionToken } from './session-token.ts'

/**
 * `InterceptorManager.handlers` не типизирован публично (см. `axios/lib/core/InterceptorManager.js`)
 * — единственный способ вызвать зарегистрированный в `axios.instance.ts` интерцептор напрямую в
 * тесте, без реального HTTP-запроса.
 */
async function runRequestInterceptor(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
    const fulfilled = api.interceptors.request.handlers?.[0]?.fulfilled
    if (!fulfilled) throw new Error('Authorization-интерцептор не зарегистрирован в axios.instance.ts')
    return fulfilled(config)
}

/**
 * add-bitrix24-auth-and-rbac, раздел 15 tasks.md; spec:
 * session#header-delivery-for-iframe — в iframe-контексте session_id
 * подставляется в заголовок Authorization, а не отправляется через cookie.
 */
describe('axios interceptor — Authorization: Bearer в iframe-контексте', () => {
    afterEach(() => {
        // @ts-expect-error — сбрасываем то, что тест мог подменить на window.top/window.BX24.
        delete window.top
        window.top = window
        delete window.BX24
        setSessionToken(null)
    })

    function enterIframeContext() {
        Object.defineProperty(window, 'top', { value: {}, configurable: true })
        window.BX24 = {}
    }

    it('подставляет заголовок Authorization в iframe-контексте, когда токен установлен', async () => {
        enterIframeContext()
        setSessionToken('session-abc')

        const config = await runRequestInterceptor({ headers: new AxiosHeaders() } as InternalAxiosRequestConfig)

        expect(config.headers.get('Authorization')).toBe('Bearer session-abc')
    })

    it('не подставляет заголовок Authorization в iframe-контексте без установленного токена', async () => {
        enterIframeContext()

        const config = await runRequestInterceptor({ headers: new AxiosHeaders() } as InternalAxiosRequestConfig)

        expect(config.headers.has('Authorization')).toBe(false)
    })

    it('не подставляет заголовок Authorization в standalone-контексте, даже если токен установлен', async () => {
        setSessionToken('session-abc')

        const config = await runRequestInterceptor({ headers: new AxiosHeaders() } as InternalAxiosRequestConfig)

        expect(config.headers.has('Authorization')).toBe(false)
    })

    it('доставка session_id для cookie-варианта — withCredentials включён (spec: session#cookie-delivery-for-standalone-and-ios)', () => {
        expect(api.defaults.withCredentials).toBe(true)
    })
})

/**
 * add-bitrix24-auth-and-rbac, раздел 13 tasks.md (примечание к разделу) +
 * раздел 16 — double-submit CSRF cookie-варианта нигде явно не заводился
 * отдельной frontend-задачей, но без него мутирующие запросы cookie-сессии
 * (например `POST /v1/auth/logout` из `features/Auth`'s `useLogout`)
 * отклонялись бы `CsrfGuard` 403-м (`backend/src/modules/session/interface/
 * csrf.guard.ts`). Значения имён cookie/заголовка — `csrf_token`/
 * `x-csrf-token` (`backend/src/modules/session/session.config.ts`, не
 * HttpOnly по Decision 7 design.md, поэтому читаемая через `document.cookie`).
 */
describe('axios interceptor — CSRF double-submit cookie для мутирующих запросов', () => {
    afterEach(() => {
        document.cookie = 'csrf_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/'
    })

    it('подставляет x-csrf-token из cookie для POST, когда csrf_token cookie установлена', async () => {
        document.cookie = 'csrf_token=abc123'

        const config = await runRequestInterceptor({
            method: 'post',
            headers: new AxiosHeaders(),
        } as InternalAxiosRequestConfig)

        expect(config.headers.get('x-csrf-token')).toBe('abc123')
    })

    it('не подставляет x-csrf-token для безопасного метода GET', async () => {
        document.cookie = 'csrf_token=abc123'

        const config = await runRequestInterceptor({
            method: 'get',
            headers: new AxiosHeaders(),
        } as InternalAxiosRequestConfig)

        expect(config.headers.has('x-csrf-token')).toBe(false)
    })

    it('не подставляет x-csrf-token, когда cookie csrf_token отсутствует (например, доставка сессии заголовком в iframe)', async () => {
        const config = await runRequestInterceptor({
            method: 'post',
            headers: new AxiosHeaders(),
        } as InternalAxiosRequestConfig)

        expect(config.headers.has('x-csrf-token')).toBe(false)
    })
})
