import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { TASKS_QUERY_KEY_PREFIX } from './api.ts'
import { useDeleteTask } from './useDeleteTask.ts'

/**
 * delete-task-frontend, tasks.md группа 1: `useDeleteTask` — тонкая `useMutation`-обёртка над
 * `tasksApi.remove` (`DELETE /v1/tasks/:id`), по прецеденту `useUpdateTask.spec.tsx` — мокаем
 * `@/shared/api/axios.instance.ts`, проверяем, что успешная мутация делает запрос без тела и
 * инвалидирует `TASKS_QUERY_KEY_PREFIX`, а ошибка API прокидывается наружу как `error`.
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

function renderDeleteTask(taskId: string, queryClient: QueryClient) {
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useDeleteTask(taskId), { wrapper })
}

function makeQueryClient() {
    return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

describe('useDeleteTask', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.delete).mockReset()
    })

    it('успешная мутация делает DELETE /v1/tasks/:id без тела и инвалидирует TASKS_QUERY_KEY_PREFIX', async () => {
        vi.mocked(axiosInstance.delete).mockResolvedValue({ data: undefined })
        const queryClient = makeQueryClient()
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderDeleteTask('task-1', queryClient)

        act(() => {
            result.current.mutate()
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(axiosInstance.delete).toHaveBeenCalledWith('/v1/tasks/task-1')
        expect(axiosInstance.delete).toHaveBeenCalledTimes(1)
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: TASKS_QUERY_KEY_PREFIX })
    })

    it('ошибка API (в т.ч. 404) прокидывается наружу как error, не глотается молча', async () => {
        const apiError = { response: { status: 404, data: { message: 'Задача не найдена' } } }
        vi.mocked(axiosInstance.delete).mockRejectedValue(apiError)
        const queryClient = makeQueryClient()
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderDeleteTask('task-1', queryClient)

        act(() => {
            result.current.mutate()
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error).toBe(apiError)
        expect(invalidateSpy).not.toHaveBeenCalled()
    })
})
