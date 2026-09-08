import { useAuthStore } from './authStore.ts'

// Dev-only байпас авторизации, см. app/route-guard/model/useRouteGuardState.ts
// за подробным описанием гейта (`import.meta.env.DEV` инертен в `vite build`).
const isAuthBypassed = import.meta.env.DEV && import.meta.env.VITE_AUTH_DISABLED === 'true'

/**
 * add-bitrix24-auth-and-rbac, раздел 16 tasks.md; architecture.md
 * `useHasPermission`: "state-хук (читает Zustand-стор)" -> `boolean`.
 * Синхронный селектор без собственного запроса — permissions в сторе
 * наполняет `useCurrentUser` (см. её WHY-комментарий).
 */
export function useHasPermission(permission: string): boolean {
    return useAuthStore((state) => isAuthBypassed || state.permissions.includes(permission))
}
