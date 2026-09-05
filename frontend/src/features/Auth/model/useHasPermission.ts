import { useAuthStore } from './authStore.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 16 tasks.md; architecture.md
 * `useHasPermission`: "state-хук (читает Zustand-стор)" -> `boolean`.
 * Синхронный селектор без собственного запроса — permissions в сторе
 * наполняет `useCurrentUser` (см. её WHY-комментарий).
 */
export function useHasPermission(permission: string): boolean {
    return useAuthStore((state) => state.permissions.includes(permission))
}
