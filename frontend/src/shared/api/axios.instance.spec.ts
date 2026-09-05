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
