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

export function useRouteGuardState(requiredPermission?: string) {
    const context = detectRuntimeContext()
    const { data: session, isLoading } = useQuery(routeGuardApi.getCurrentSession())

    const hasSession = session != null
    const hasRequiredPermission =
        requiredPermission === undefined || (session?.permissions.includes(requiredPermission) ?? false)

    return {
        context,
        isLoading,
        hasSession,
        hasRequiredPermission,
    }
}
