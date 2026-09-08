import { useQuery } from '@tanstack/react-query'

import { detectRuntimeContext } from '@/shared/lib/runtime-context.ts'

import { routeGuardApi } from './session.api.ts'

// Тип метаданных роута для защиты по permission — `handle` объекта роута
// React Router (`app/router.tsx`), читается через `useMatches()` в
// `ui/RouteGuard.tsx`. Ни один роут пока такое не объявляет (страница
// `pages/RolesManagement` с `requiredPermission: 'roles:manage'`
// появляется в разделе 20 tasks.md) — RouteGuard уже поддерживает
// механизм, чтобы раздел 20 подключил его без изменений в самом guard'е.
export type RouteHandle = {
    requiredPermission?: string
}

// Dev-only байпас авторизации (тестирование функциональности без Bitrix24
// OAuth/embedded-логина) — активен только при `vite dev` (`import.meta.env.DEV`
// всегда `false` в любой сборке `vite build`, в т.ч. Docker-сборках
// прод/dev-стенда), см. backend/src/shared/config/dev-auth-bypass.ts за
// симметричным backend-байпасом.
const isAuthBypassed = import.meta.env.DEV && import.meta.env.VITE_AUTH_DISABLED === 'true'

export function useRouteGuardState(requiredPermission?: string) {
    const context = detectRuntimeContext()
    const { data: session, isLoading } = useQuery(routeGuardApi.getCurrentSession())

    const hasSession = isAuthBypassed || session != null
    const hasRequiredPermission =
        isAuthBypassed ||
        requiredPermission === undefined ||
        (session?.permissions.includes(requiredPermission) ?? false)

    return {
        context,
        isLoading,
        hasSession,
        hasRequiredPermission,
    }
}
