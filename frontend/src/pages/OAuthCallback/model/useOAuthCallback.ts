import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { AUTH_ME_QUERY_KEY, authApi, consumeStoredOAuthState, getOAuthRedirectUri } from '@/features/Auth'

/**
 * add-bitrix24-auth-and-rbac, раздел 23 tasks.md; architecture.md `useOAuthCallback`:
 * "mutation-хук" -> `{ status: 'processing'|'error' }`. Принимает редирект Bitrix24
 * (`?code=&state=`), сверяет `state` (spec: auth#oauth-login-csrf-state-protection) ДО отправки
 * `code` на backend (spec: auth#oauth-callback-frontend-route) и, при успешном обмене, обновляет
 * кэш `GET /v1/auth/me` (`AUTH_ME_QUERY_KEY`, тот же ключ, что `route-guard`/`useCurrentUser`
 * используют для текущей сессии) и уводит пользователя на главную.
 */
export type OAuthCallbackStatus = 'processing' | 'error'

export function useOAuthCallback(): { status: OAuthCallbackStatus } {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [status, setStatus] = useState<OAuthCallbackStatus>('processing')
    const mutation = useMutation({ mutationFn: authApi.oauthExchange })
    // Обмен `code` должен выполниться ровно один раз за время жизни страницы (spec:
    // auth#oauth-login-csrf-state-protection — state используется одноразово); без этой защёлки
    // повторный запуск эффекта (например, смена ссылки на функции из хуков между рендерами)
    // повторно вызвал бы `consumeStoredOAuthState()`, которая ко второму разу уже вернула бы null.
    const hasStartedRef = useRef(false)

    useEffect(() => {
        if (hasStartedRef.current) return
        hasStartedRef.current = true

        const code = searchParams.get('code')
        const urlState = searchParams.get('state')
        // Одно действие — читает и сразу удаляет сохранённое значение (см. `oauthState.ts`),
        // поэтому сверка одноразовая независимо от результата ниже (spec: auth#oauth-login-csrf-
        // state-protection).
        const storedState = consumeStoredOAuthState()

        if (!code || !storedState || storedState !== urlState) {
            setStatus('error')
            return
        }

        mutation.mutate(
            { code, state: urlState ?? undefined, redirectUri: getOAuthRedirectUri() },
            {
                onSuccess: () => {
                    void queryClient.invalidateQueries({ queryKey: AUTH_ME_QUERY_KEY })
                    navigate('/', { replace: true })
                },
                onError: () => setStatus('error'),
            },
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps -- один запуск при монтировании, см. hasStartedRef выше
    }, [])

    return { status }
}
