import { create } from 'zustand'
import type { AuthenticatedEmployee } from 'ireports-contracts'

/**
 * add-bitrix24-auth-and-rbac, раздел 16 tasks.md — первое использование
 * zustand в проекте (frontend/CLAUDE.md: "если потребуется стейт менеджер,
 * то используй Zustand... только для хранения бизнес данных"). Стор держит
 * только уже загруженные сессию/permissions текущего сотрудника
 * (architecture.md: `authStore.ts` — "employee, permissions, status") —
 * сам запрос `GET /v1/auth/me` и его кэш/рефетч остаются на TanStack Query
 * стороне `useCurrentUser` (model/api.ts), которая пишет результат сюда как
 * побочный эффект. `useHasPermission` читает permissions отсюда напрямую,
 * без похода в React Query кэш — эквивалентно, но не требует, чтобы каждый
 * потребитель permission-проверки помнил точный queryKey `useCurrentUser`.
 *
 * `status`:
 * - `idle` — `useCurrentUser` ещё не отработал ни разу (стартовое значение);
 * - `authenticated`/`unauthenticated` — по последнему ответу `GET /v1/auth/me`.
 */
export type AuthStatus = 'idle' | 'authenticated' | 'unauthenticated'

export type AuthenticatedSession = {
    employee: AuthenticatedEmployee
    permissions: string[]
}

type AuthStoreState = {
    employee: AuthenticatedEmployee | null
    permissions: string[]
    status: AuthStatus
    setAuthenticated: (session: AuthenticatedSession) => void
    setUnauthenticated: () => void
}

export const useAuthStore = create<AuthStoreState>((set) => ({
    employee: null,
    permissions: [],
    status: 'idle',
    setAuthenticated: ({ employee, permissions }) => set({ employee, permissions, status: 'authenticated' }),
    setUnauthenticated: () => set({ employee: null, permissions: [], status: 'unauthenticated' }),
}))
