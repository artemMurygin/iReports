// Публичный API `features/Auth` (add-bitrix24-auth-and-rbac, раздел 16
// tasks.md; architecture.md: "useHasPermission, useCurrentUser, useLogout,
// useBitrixLogin, RequirePermission") — только корневые экспорты,
// импортировать фичу следует исключительно отсюда (frontend/CLAUDE.md).
export { useHasPermission } from './model/useHasPermission.ts'
export { useCurrentUser, type CurrentUserState } from './model/useCurrentUser.ts'
export { useLogout } from './model/useLogout.ts'
export { useBitrixLogin } from './model/useBitrixLogin.ts'
export { RequirePermission } from './ui/RequirePermission.tsx'

// Раздел 23 tasks.md — нужны `pages/OAuthCallback`'s `useOAuthCallback` (frontend/CLAUDE.md:
// импорт фичи только через её `index.ts`, `pages` не может обращаться к `features/Auth/model/*`
// напрямую): `AUTH_ME_QUERY_KEY` — инвалидировать кэш `GET /v1/auth/me` после успешного обмена
// `code` на сессию; `authApi.oauthExchange` — сам запрос (`api` экспортируется под алиасом, чтобы
// не путать с одноимённым `api` других фич/страниц у потребителя); `consumeStoredOAuthState` —
// та же сверка/удаление одноразового `state`, что использует `useBitrixLogin` при генерации.
export { AUTH_ME_QUERY_KEY, api as authApi } from './model/api.ts'
export { OAUTH_STATE_STORAGE_KEY, consumeStoredOAuthState } from './model/oauthState.ts'
