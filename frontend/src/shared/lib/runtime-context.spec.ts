import { afterEach, describe, expect, it } from 'vitest'

import { detectRuntimeContext } from './runtime-context.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 15 tasks.md; design.md Decision 8 —
 * embedded-контекст распознаётся ТОЛЬКО по совпадению двух признаков сразу
 * (window.self !== window.top И наличие BX24 SDK), чтобы случайное открытие
 * сайта в постороннем iframe не давало ложный 'iframe'.
 */
describe('detectRuntimeContext', () => {
    afterEach(() => {
        // @ts-expect-error — сбрасываем то, что тест мог подменить на window.top/window.BX24.
        delete window.top
        window.top = window
        delete window.BX24
    })

    it("возвращает 'iframe', когда сайт внутри фрейма И подключён Bitrix24 SDK", () => {
        Object.defineProperty(window, 'top', { value: {}, configurable: true })
        // Тестам этого файла важно только присутствие window.BX24 (наличие SDK), а не его реальная
        // форма — детальная типизация BitrixAuthInfo/init/getAuth (см. runtime-context.ts) нужна
        // только потребителям, реально вызывающим BX24.init()/getAuth() (features/Auth's
        // useEmbeddedLoginBootstrap), поэтому здесь достаточно минимальной заглушки с приведением типа.
        window.BX24 = { init: () => {}, getAuth: () => false }

        expect(detectRuntimeContext()).toBe('iframe')
    })

    it("возвращает 'standalone', когда сайт внутри фрейма, но BX24 SDK не подключён (посторонний iframe)", () => {
        Object.defineProperty(window, 'top', { value: {}, configurable: true })

        expect(detectRuntimeContext()).toBe('standalone')
    })

    it("возвращает 'standalone', когда BX24 SDK подключён, но сайт не внутри фрейма", () => {
        // Тестам этого файла важно только присутствие window.BX24 (наличие SDK), а не его реальная
        // форма — детальная типизация BitrixAuthInfo/init/getAuth (см. runtime-context.ts) нужна
        // только потребителям, реально вызывающим BX24.init()/getAuth() (features/Auth's
        // useEmbeddedLoginBootstrap), поэтому здесь достаточно минимальной заглушки с приведением типа.
        window.BX24 = { init: () => {}, getAuth: () => false }

        expect(detectRuntimeContext()).toBe('standalone')
    })

    it("возвращает 'standalone' вне iframe и без BX24 SDK (обычный standalone-визит)", () => {
        expect(detectRuntimeContext()).toBe('standalone')
    })
})
