import { createAndStoreOAuthState } from './oauthState.ts'

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
 * ОТКРЫТЫЙ ВОПРОС (не решался самостоятельно, см. финальный отчёт раздела
 * 16 tasks.md): ни proposal.md/specs/design.md/architecture.md не
 * описывают `client_id`/`redirect_uri` реального редиректа — backend тоже
 * не запрашивает `redirect_uri` при обмене `code`
 * (`BitrixOAuthLoginHandler.exchangeCodeForTokens`). Раздел 23 tasks.md
 * закрыл только часть вопроса, касающуюся `state` (design.md Decision 13) и
 * страницы приёма callback (`pages/OAuthCallback`) — `client_id`/
 * `redirect_uri` остаются сознательно не домысленными.
 */
const BITRIX_PORTAL_DOMAIN = 'irepair.bitrix24.ru'

export function useBitrixLogin() {
    return {
        login: () => {
            const state = createAndStoreOAuthState()
            const authorizeUrl = new URL(`https://${BITRIX_PORTAL_DOMAIN}/oauth/authorize/`)
            authorizeUrl.searchParams.set('state', state)

            window.location.assign(authorizeUrl.toString())
        },
    }
}
