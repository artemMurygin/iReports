import { queryOptions } from '@tanstack/react-query'
import type {
    AuthMeResponse,
    BitrixOAuthCallbackRequest,
    BitrixOAuthCallbackResponse,
    LogoutResponse,
} from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/**
 * `features/Auth` — сессия и permissions текущего сотрудника
 * (add-bitrix24-auth-and-rbac, раздел 16 tasks.md; architecture.md
 * `features/Auth`). По образцу `features/EmployeeBalance/model/api.ts`:
 * запросы — `queryOptions`-фабрики, не голые async-функции.
 */

// Тот же query-ключ ('auth-me'), которым уже пользуется `app/route-guard/model/
// session.api.ts` (раздел 15 tasks.md, `AUTH_SESSION_QUERY_KEY`) — совпадение
// значения ключа (а не общий импорт: `route-guard` живёт в `app`, `features`
// не может импортировать `app` по границам FSD) даёт TanStack Query разделить
// один и тот же закэшированный результат `GET /v1/auth/me` между route-guard'ом
// и этой фичей вместо двух независимых сетевых запросов. См. WHY-комментарий
// в session.api.ts — раздел 15 сознательно оставил объединение на раздел 16.
export const AUTH_ME_QUERY_KEY = ['auth-me'] as const

/**
 * 401 ("нет подтверждённой сессии") — ожидаемое состояние, а не ошибка
 * приложения (тот же fail-closed приём, что и в `route-guard/model/
 * session.api.ts`), поэтому в отличие от общей конвенции `ApiError` в
 * `.catch()` (frontend/CLAUDE.md) любая неудача запроса сворачивается в
 * `null`, а не прокидывается как исключение — `useCurrentUser`
 * интерпретирует `null` как "employee: null, permissions: []", не как
 * ошибку для показа пользователю.
 */
export const api = {
    getCurrentUser: () =>
        queryOptions({
            queryKey: AUTH_ME_QUERY_KEY,
            queryFn: (): Promise<AuthMeResponse | null> =>
                apiInstance
                    .get<AuthMeResponse>('/v1/auth/me')
                    .then((response) => response.data)
                    .catch(() => null),
            retry: false,
            staleTime: 60_000,
        }),

    // POST /v1/auth/logout (spec: session#logout-deletes-session-server-side) —
    // удаляет сессию в Redis на бэкенде, не только локальное состояние.
    // Мутирующий запрос cookie-сессии — проходит через CSRF double-submit
    // (`CsrfGuard`, раздел 13 tasks.md; заголовок `x-csrf-token` подставляется
    // axios-интерцептором в `shared/api/axios.instance.ts`, не здесь). В
    // отличие от `getCurrentUser` выше — обычная мутация, ошибка не является
    // ожидаемым состоянием, поэтому оборачивается в `ApiError` (frontend/
    // CLAUDE.md — общая конвенция).
    logout: (): Promise<LogoutResponse> =>
        apiInstance
            .post<LogoutResponse>('/v1/auth/logout')
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError('Не удалось выполнить выход ' + error)
            }),

    // POST /v1/auth/oauth/callback (spec: auth#oauth-authorization-code-flow,
    // auth#oauth-callback-frontend-route) — обмен `code` на токены строго на backend, уже
    // реализован в разделе 12 tasks.md. Вызывается `pages/OAuthCallback`'s `useOAuthCallback`
    // (раздел 23 tasks.md) ПОСЛЕ того, как `state` из URL сверен с сохранённым в `sessionStorage`
    // значением (design.md Decision 13) — сама сверка происходит на вызывающей стороне, не здесь.
    oauthExchange: (payload: BitrixOAuthCallbackRequest): Promise<BitrixOAuthCallbackResponse> =>
        apiInstance
            .post<BitrixOAuthCallbackResponse>('/v1/auth/oauth/callback', payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError('Не удалось войти через Bitrix24 ' + error)
            }),
}
