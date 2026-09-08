/**
 * add-bitrix24-auth-and-rbac, раздел 23 tasks.md; design.md Decision 13 (spec:
 * auth#oauth-login-csrf-state-protection) — защита OAuth-флоу от login-CSRF через сверку `state`.
 * `state` генерируется и хранится ИСКЛЮЧИТЕЛЬНО на frontend (backend его не проверяет, design.md
 * Decision 13 — принимает только транзитом): `useBitrixLogin` сохраняет значение перед редиректом,
 * `pages/OAuthCallback`'s `useOAuthCallback` сверяет его с тем, что вернулось в URL.
 *
 * `sessionStorage`, а не `localStorage` — значение не должно переживать вкладку/сессию браузера
 * дольше, чем нужно для одного логин-флоу (design.md Decision 13).
 */
export const OAUTH_STATE_STORAGE_KEY = 'ireports.oauthState'

// 32 случайных байта, как у SessionId на backend (`session-id.value-object.ts`, session#session-
// id-entropy) — тот же уровень энтропии, base64url без padding.
const STATE_ENTROPY_BYTES = 32

function generateRandomState(): string {
    const bytes = new Uint8Array(STATE_ENTROPY_BYTES)
    crypto.getRandomValues(bytes)

    let binary = ''
    for (const byte of bytes) {
        binary += String.fromCharCode(byte)
    }

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Генерирует новый `state` и сохраняет его в `sessionStorage` — вызывается `useBitrixLogin().login()`
 * непосредственно перед редиректом на `{portal}/oauth/authorize/`.
 */
export function createAndStoreOAuthState(): string {
    const state = generateRandomState()
    sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, state)
    return state
}

/**
 * Читает сохранённый `state` и немедленно удаляет его из `sessionStorage` — одним действием, а не
 * раздельным чтением/удалением, чтобы сверка (см. `useOAuthCallback`) была одноразовой независимо
 * от результата: удаление происходит ровно один раз что при совпадении, что при несовпадении/
 * отсутствии значения (spec: auth#oauth-login-csrf-state-protection — "использование допустимо
 * только один раз"), без дополнительного `removeItem` в вызывающем коде.
 */
export function consumeStoredOAuthState(): string | null {
    const stored = sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY)
    sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
    return stored
}

/**
 * `redirect_uri` для OAuth-редиректа — голый текущий origin, БЕЗ пути `/auth/callback`.
 *
 * Bitrix24 для локальных приложений ("Путь вашего обработчика" в настройках приложения)
 * ИГНОРИРУЕТ значение `redirect_uri`, переданное в запросе на `{portal}/oauth/authorize/`, и
 * всегда возвращает браузер на URL из этого поля настроек — подтверждено логами реального
 * 302-редиректа на dev-стенде (`Location` в ответе Bitrix = origin без пути, несмотря на
 * `redirect_uri=.../auth/callback` в запросе). Значение здесь должно буквально совпадать с
 * «Путём вашего обработчика» в настройках приложения — отсюда просто origin, а не подпуть.
 * `code`/`state` поэтому принимаются на корневом маршруте (`app/route-guard/ui/RouteGuard.tsx`),
 * а не на выделенной странице `pages/OAuthCallback` (тот роут остаётся зарегистрированным, но
 * Bitrix на него не редиректит).
 *
 * Не хардкодится под конкретное окружение (localhost/staging/прод), чтобы одна и та же сборка
 * работала везде. Используется и `useBitrixLogin` (в исходном редиректе), и `useOAuthCallback`
 * (при обмене `code` — обязано совпадать со значением из исходного редиректа, RFC 6749 §4.1.3).
 */
export function getOAuthRedirectUri(): string {
    return window.location.origin
}
