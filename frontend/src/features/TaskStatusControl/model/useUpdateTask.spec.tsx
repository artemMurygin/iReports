import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { TASKS_QUERY_KEY_PREFIX } from './api.ts'
import { useUpdateTask } from './useUpdateTask.ts'

/**
 * edit-task, tasks.md группа 5: `useUpdateTask` — тонкая `useMutation`-обёртка над
 * `tasksApi.update` (`PATCH /v1/tasks/:id`), по прецеденту `useCreateTask.spec.tsx`/
 * `useTaskTransition.ts` — мокаем `@/shared/api/axios.instance.ts`, проверяем, что успешная
 * мутация инвалидирует `TASKS_QUERY_KEY_PREFIX`.
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

function renderUpdateTask(taskId: string, queryClient: QueryClient) {
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useUpdateTask(taskId), { wrapper })
}

function makeQueryClient() {
    return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

describe('useUpdateTask', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.patch).mockReset()
    })

    it('успешная мутация инвалидирует TASKS_QUERY_KEY_PREFIX', async () => {
        vi.mocked(axiosInstance.patch).mockResolvedValue({ data: { id: 'task-1' } })
        const queryClient = makeQueryClient()
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderUpdateTask('task-1', queryClient)

        act(() => {
            result.current.mutate({ title: 'Новый заголовок' })
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(axiosInstance.patch).toHaveBeenCalledWith('/v1/tasks/task-1', { title: 'Новый заголовок' })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: TASKS_QUERY_KEY_PREFIX })
    })
})
