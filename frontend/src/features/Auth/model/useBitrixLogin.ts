import { createAndStoreOAuthState, getOAuthRedirectUri } from './oauthState.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 16 tasks.md; architecture.md
 * `useBitrixLogin`: "обычный хук (без запроса — формирует URL и делает
 * redirect)" -> `{ login() }` — "генерирует `state`, сохраняет в
 * `sessionStorage` (design.md Decision 13), редиректит на
 * `{portal}/oauth/authorize/`" (spec: auth#oauth-authorization-code-flow,
 * auth#oauth-login-csrf-state-protection). Редирект запускается по клику
 * пользователя на CTA `pages/Login` (раздел 18 tasks.md), не автоматически.
 *
 * Домен портала захардкожен — design.md: приложение single-tenant, тот же
 * приём, что и `BitrixAuthService.saveInstallation` на backend (второго
 * портала не предполагается).
 *
 * `client_id`/`redirect_uri` — без них Bitrix24 не может определить, какое
 * приложение запрашивает авторизацию (обязательные параметры OAuth 2.0,
 * найдено как реальный блокер при попытке локального запуска). `client_id`
 * НЕ секрет (в отличие от `client_secret`, который никогда не покидает
 * backend, spec: auth#client-secret-isolation) — безопасно передавать его
 * во фронтенд-бандл через `VITE_BITRIX24_CLIENT_ID`. `redirect_uri`
 * вычисляется от текущего origin (`getOAuthRedirectUri`, `oauthState.ts`) —
 * то же значение backend обязан передать при обмене `code` на токены
 * (`BitrixOAuthLoginHandler`, RFC 6749 §4.1.3), см. `useOAuthCallback`.
 */
const BITRIX_PORTAL_DOMAIN = 'irepair.bitrix24.ru'

export function useBitrixLogin() {
    return {
        login: () => {
            const state = createAndStoreOAuthState()
            const authorizeUrl = new URL(`https://${BITRIX_PORTAL_DOMAIN}/oauth/authorize/`)
            authorizeUrl.searchParams.set('response_type', 'code')
            authorizeUrl.searchParams.set('client_id', import.meta.env.VITE_BITRIX24_CLIENT_ID ?? '')
            authorizeUrl.searchParams.set('redirect_uri', getOAuthRedirectUri())
            authorizeUrl.searchParams.set('state', state)

            window.location.assign(authorizeUrl.toString())
        },
    }
}
