import { useOAuthCallback } from '../model/useOAuthCallback.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 23 tasks.md; architecture.md `pages/OAuthCallback`: "Приём
 * редиректа от Bitrix24 (`code`, `state`)... без собственной визуальной идентичности (короткий
 * "Выполняется вход…")" — страница не по Pencil-фрейму (не входит в ui-design.md), поэтому это
 * простой текст, а не UI Kit-компонент. Регистрируется отдельным top-level роутом
 * (`app/router.tsx`), вне `app/route-guard/ui/RouteGuard.tsx` — в момент обмена `code` на токены
 * валидной сессии ещё не существует, `RouteGuard` увёл бы на `pages/Login` раньше, чем страница
 * успела бы отправить `code` на backend.
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
