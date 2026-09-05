/**
 * add-bitrix24-auth-and-rbac, раздел 16 tasks.md; architecture.md
 * `useBitrixLogin`: "обычный хук (без запроса — формирует URL и делает
 * redirect)" -> `{ login() }` — "редиректит на `{portal}/oauth/authorize/`"
 * (spec: auth#oauth-authorization-code-flow). Редирект запускается по клику
 * пользователя на CTA `pages/Login` (раздел 18 tasks.md), не автоматически.
 *
 * Домен портала захардкожен — design.md: приложение single-tenant, тот же
 * приём, что и `BitrixAuthService.saveInstallation` на backend (второго
 * портала не предполагается).
 *
 * ОТКРЫТЫЙ ВОПРОС (не решался самостоятельно, см. финальный отчёт раздела
 * 16 tasks.md): ни proposal.md/specs/design.md/architecture.md не
 * описывают query-параметры реального редиректа (`client_id`,
 * `redirect_uri`, `state`) — backend тоже не запрашивает `redirect_uri` при
 * обмене `code` (`BitrixOAuthLoginHandler.exchangeCodeForTokens`), и ни один
 * раздел tasks.md не заводит frontend-страницу, принимающую обратный
 * редирект Bitrix24 с `?code=&state=` и передающую их в `POST
 * /v1/auth/oauth/callback`. Реализация ниже сознательно ограничена
 * буквальной формулировкой architecture.md, без домысливания этих
 * параметров и недостающей страницы.
 */
const BITRIX_PORTAL_DOMAIN = 'irepair.bitrix24.ru'

export function useBitrixLogin() {
    return {
        login: () => {
            window.location.assign(`https://${BITRIX_PORTAL_DOMAIN}/oauth/authorize/`)
        },
    }
}
