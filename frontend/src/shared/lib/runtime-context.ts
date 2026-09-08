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
//
// `BitrixAuthInfo` — форма ответа `BX24.getAuth()` (официальная документация
// Bitrix24): `access_token`/`refresh_token` — токены сессии BX24 (не
// авторизации самого iReports, add-bitrix24-auth-and-rbac, раздел 15/16
// tasks.md), `domain` — домен портала, `member_id` — идентификатор портала,
// `expires_in` — TTL `access_token` в секундах. Используется
// `features/Auth`'s `useEmbeddedLoginBootstrap` (раздел 16 tasks.md) для
// embedded-входа — см. `spec: auth#embedded-login-success`. `init` —
// асинхронная инициализация SDK, `callback` вызывается когда BX24 готов
// (пример из документации Bitrix24: `BX24.init(() => { const authInfo =
// BX24.getAuth() })`).
interface BitrixAuthInfo {
    access_token: string
    domain: string
    expires_in: number
    member_id: string
    refresh_token: string
}

declare global {
    interface Window {
        BX24?: {
            init: (callback: () => void) => void
            getAuth: () => BitrixAuthInfo | false
        }
    }
}

export function detectRuntimeContext(): RuntimeContext {
    const isInsideIframe = window.self !== window.top
    const hasBitrixSdk = typeof window.BX24 !== 'undefined'

    return isInsideIframe && hasBitrixSdk ? 'iframe' : 'standalone'
}
