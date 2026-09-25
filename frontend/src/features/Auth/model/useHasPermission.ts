import { useAuthStore } from './authStore.ts'

// Dev-only байпас авторизации, см. app/route-guard/model/useRouteGuardState.ts
// за подробным описанием гейта (`import.meta.env.DEV` инертен в `vite build`).
const isAuthBypassed = import.meta.env.DEV && import.meta.env.VITE_AUTH_DISABLED === 'true'

/**
 * add-bitrix24-auth-and-rbac, раздел 16 tasks.md; architecture.md
 * `useHasPermission`: "state-хук (читает Zustand-стор)" -> `boolean`.
 * Синхронный селектор без собственного запроса — permissions в сторе
 * наполняет `useCurrentUser` (см. её WHY-комментарий).
 *
 * add-frontend-page-access-guard, раздел 1 tasks.md; design.md "useHasPermission
 * расширяется на массив, а не дублируется" — `permission` может быть массивом
 * кодов, тогда действует OR-семантика (`.some()`): достаточно одного совпадения
 * с правами пользователя. Единственная сигнатура переиспользуется и `RouteGuard`
 * (задача 2), и `Header` (задача 6), и точечными проверками `RequirePermission`,
 * которые продолжают передавать одиночную строку без изменений.
 */
export function useHasPermission(permission: string | string[]): boolean {
    return useAuthStore(
        (state) => isAuthBypassed || [permission].flat().some((code) => state.permissions.includes(code)),
    )
}
