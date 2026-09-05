import { useMutation, useQueryClient } from '@tanstack/react-query'

import { AUTH_ME_QUERY_KEY, api } from './api.ts'
import { useAuthStore } from './authStore.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 16 tasks.md; architecture.md
 * `useLogout`: "mutation-хук" -> `{ logout(), isPending }`. После успеха
 * сбрасывает и `authStore` (мгновенно для `useHasPermission`/других
 * потребителей стора), и закэшированный ответ `GET /v1/auth/me`
 * (`AUTH_ME_QUERY_KEY`) — без этого следующий рендер, всё ещё читающий
 * `useQuery(api.getCurrentUser())` из кэша (`staleTime: 60_000`), увидел бы
 * прежнего пользователя до истечения staleTime.
 */
export function useLogout() {
    const queryClient = useQueryClient()
    const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated)

    const mutation = useMutation({
        mutationFn: api.logout,
        onSuccess: () => {
            setUnauthenticated()
            queryClient.setQueryData(AUTH_ME_QUERY_KEY, null)
        },
    })

    return {
        logout: mutation.mutate,
        isPending: mutation.isPending,
    }
}
