import { useOAuthCallback } from '../model/useOAuthCallback.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 23 tasks.md; architecture.md `pages/OAuthCallback`: "Приём
 * редиректа от Bitrix24 (`code`, `state`)... без собственной визуальной идентичности (короткий
 * "Выполняется вход…")" — страница не по Pencil-фрейму (не входит в ui-design.md), поэтому это
 * простой текст, а не UI Kit-компонент.
 *
 * Рендерится в двух местах: своим top-level роутом `/auth/callback` (`app/router.tsx`, вне
 * `RouteGuard` — в момент обмена `code` валидной сессии ещё нет, `RouteGuard` увёл бы на
 * `pages/Login`) и напрямую из `app/route-guard/ui/RouteGuard.tsx`, когда `code` приходит на
 * корень сайта — Bitrix24 для локальных приложений игнорирует `redirect_uri` из запроса и всегда
 * возвращает на "Путь вашего обработчика" из настроек приложения, см. `getOAuthRedirectUri`
 * (oauthState.ts).
 */
export function OAuthCallbackPage() {
    const { status } = useOAuthCallback()

    return (
        <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
            <p className="font-ui text-sm text-ink-muted">
                {status === 'error' ? 'Не удалось войти. Попробуйте снова.' : 'Выполняется вход…'}
            </p>
        </div>
    )
}
