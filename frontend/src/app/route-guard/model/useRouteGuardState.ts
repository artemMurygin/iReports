import { useQuery } from '@tanstack/react-query'

import { detectRuntimeContext } from '@/shared/lib/runtime-context.ts'
import { useHasAllPermissions, useHasPermission } from '@/features/Auth/model/useHasPermission.ts'

import { routeGuardApi } from './session.api.ts'

// Тип метаданных роута для защиты по permission — `handle` объекта роута
// React Router (`app/router.tsx`), читается через `useMatches()` в
// `ui/RouteGuard.tsx`. Ни один роут пока такое не объявляет (страница
// `pages/RolesManagement` с `requiredPermission: 'roles:manage'`
// появляется в разделе 20 tasks.md) — RouteGuard уже поддерживает
// механизм, чтобы раздел 20 подключил его без изменений в самом guard'е.
//
// add-frontend-page-access-guard, раздел 2 tasks.md; design.md
// "RouteHandle.requiredPermission: string -> string | string[], OR-семантика" —
// массив означает "достаточно любого одного" (страницы, объединяющие
// `service`+`shop`, см. таблицу в design.md), проверка делегирована
// `useHasPermission` (раздел 1 tasks.md).
export type RouteHandle = {
    requiredPermission?: string | string[]
    /** Own-resource fallback (add-employee-balance-own-view): роут остаётся доступен и БЕЗ
     * `requiredPermission`, если у пользователя есть `ownResourcePermission` И значение route-param
     * `ownResourceParam` (например `:id`) совпадает с id текущего сотрудника — см. `RouteGuard.tsx`,
     * которая делает само сравнение. Пример: `balance/employee/:id` (`app/router.tsx`) пускает по
     * `employee-balance:view_all` (любой сотрудник) ИЛИ по `employee-balance:view_own` + `:id` — свой. */
    ownResourcePermission?: string
    ownResourceParam?: string
    /** AND-семантика (в отличие от OR-семантики массива в `requiredPermission`): роут доступен,
     * только если у пользователя есть ВСЕ перечисленные коды — в дополнение к `requiredPermission`,
     * а не вместо него. Единственный сегодняшний случай — `settings/roles` (`app/router.tsx`):
     * `requiredPermission: 'roles:manage'` (сама страница) + `requireAllPermissions: ['settings:view']`
     * (виден ли пользователю раздел «Настройки» вообще) — оба условия обязательны одновременно. */
    requireAllPermissions?: string[]
}

// Dev-only байпас авторизации (тестирование функциональности без Bitrix24
// OAuth/embedded-логина) — активен только при `vite dev` (`import.meta.env.DEV`
// всегда `false` в любой сборке `vite build`, в т.ч. Docker-сборках
// прод/dev-стенда), см. backend/src/shared/config/dev-auth-bypass.ts за
// симметричным backend-байпасом.
const isAuthBypassed = import.meta.env.DEV && import.meta.env.VITE_AUTH_DISABLED === 'true'

export function useRouteGuardState(
    requiredPermission?: string | string[],
    ownResourcePermission?: string,
    isOwnResource?: boolean,
    requireAllPermissions?: string[],
) {
    const context = detectRuntimeContext()
    const { data: session, isLoading } = useQuery(routeGuardApi.getCurrentSession())

    const hasSession = isAuthBypassed || session != null
    // useHasPermission должен вызываться безусловно на каждый рендер (Rules of Hooks),
    // поэтому короткое замыкание по `requiredPermission === undefined`/dev-байпасу
    // применяется только к итоговому `hasRequiredPermission`, а не к самому вызову хука;
    // пустой массив в этом случае — no-op (`.some()` по пустому массиву -> false, что не
    // влияет на результат, т.к. requiredPermission === undefined уже отдаёт true раньше).
    const hasPermission = useHasPermission(requiredPermission ?? [])
    // Own-resource fallback (см. RouteHandle) — тот же приём безусловного вызова хука;
    // `isOwnResource` (сравнение route-param с id текущего сотрудника) вычисляет вызывающая
    // сторона (RouteGuard.tsx), этот хук только комбинирует его с самим permission.
    const hasOwnResourcePermission = useHasPermission(ownResourcePermission ?? [])
    const hasOwnResourceAccess = Boolean(isOwnResource) && hasOwnResourcePermission
    const hasRequiredPermission =
        isAuthBypassed || requiredPermission === undefined || hasPermission || hasOwnResourceAccess

    // `requireAllPermissions` (AND, см. RouteHandle) — та же экономия, что у `requiredPermission`
    // выше: пустой массив по умолчанию делает `.every()` тождественно `true`, не влияя на итог.
    const hasAllRequiredPermissions = useHasAllPermissions(requireAllPermissions ?? [])

    return {
        context,
        isLoading,
        hasSession,
        hasRequiredPermission,
        hasAllRequiredPermissions,
    }
}
