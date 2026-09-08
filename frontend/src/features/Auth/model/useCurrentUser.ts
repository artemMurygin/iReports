import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AuthenticatedEmployee } from 'ireports-contracts'

import { api } from './api.ts'
import { useAuthStore } from './authStore.ts'

/**
 * add-bitrix24-auth-and-rbac, раздел 16 tasks.md; architecture.md
 * `useCurrentUser`: "query options factory + хук" -> `{ employee,
 * permissions, isInitialLoad }`. Помимо возврата состояния синхронизирует
 * результат `GET /v1/auth/me` в `authStore` (побочный эффект) — так
 * `useHasPermission` в любом другом месте дерева получает актуальные права,
 * даже не будучи прямым потребителем этого хука. Ожидается один вызов этого
 * хука близко к корню приложения (`app/`), а не в каждом компоненте.
 */
export type CurrentUserState = {
    employee: AuthenticatedEmployee | null
    permissions: string[]
    isInitialLoad: boolean
}

export function useCurrentUser(): CurrentUserState {
    const { data, isLoading } = useQuery(api.getCurrentUser())
    const setAuthenticated = useAuthStore((state) => state.setAuthenticated)
    const setUnauthenticated = useAuthStore((state) => state.setUnauthenticated)

    useEffect(() => {
        if (data === undefined) return // запрос ещё не завершился — не трогаем стор
        if (data === null) {
            setUnauthenticated()
        } else {
            setAuthenticated(data)
        }
    }, [data, setAuthenticated, setUnauthenticated])

    return {
        employee: data?.employee ?? null,
        permissions: data?.permissions ?? [],
        isInitialLoad: isLoading,
    }
}
