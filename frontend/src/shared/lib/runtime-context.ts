// Определение контекста запуска приложения (add-bitrix24-auth-and-rbac,
// design.md Decision 8; spec: auth#... контекст определяет способ доставки
// session_id — cookie для standalone/iOS, Authorization-заголовок для
// iframe, см. specs/session/spec.md). Признак embedded-контекста —
// `window.self !== window.top` (внутри iframe) И наличие BX24 SDK
// ОДНОВРЕМЕННО, а не только один из признаков — защита от случайного
// открытия сайта в постороннем iframe (design.md Decision 8). Иначе —
// standalone (сайт или iOS WebView).
export type RuntimeContext = 'iframe' | 'standalone'

// BX24 — глобальный объект, который подключает Bitrix24 JS SDK
// (`//api.bitrix24.com/api/v1/`) внутри iframe портала; вне портала этот
// скрипт не подключается, поэтому `window.BX24` отсутствует.
declare global {
    interface Window {
        BX24?: unknown
    }
}

export function detectRuntimeContext(): RuntimeContext {
    const isInsideIframe = window.self !== window.top
    const hasBitrixSdk = typeof window.BX24 !== 'undefined'

    return isInsideIframe && hasBitrixSdk ? 'iframe' : 'standalone'
}
