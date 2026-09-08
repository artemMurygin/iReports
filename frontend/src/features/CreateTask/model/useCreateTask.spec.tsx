import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

import { useCreateTask } from './useCreateTask.ts'

/**
 * replace-bitrix-task-integration, раздел 11 tasks.md (11.1): `useCreateTask` — тонкая
 * `useMutation`-обёртка над `api.createTask` (`POST /v1/tasks`, единственный вход создания задачи,
 * design.md решение 1/4) — по прецеденту `useLogout`/`useSetTaskCompletionLineReward` (мокаем
 * `@/shared/api/axios.instance.ts`, проверяем и вызов, и то, что ошибка backend оборачивается в
 * `ApiError` через `extractApiErrorMessage` в `.catch()` — не сырую axios-ошибку).
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn() },
}))

function renderCreateTask(queryClient: QueryClient) {
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useCreateTask(), { wrapper })
}

const PAYLOAD = {
    title: 'Проверить отчёт по кассе',
    description: 'Сверить суммы начислений за месяц',
    deadline: '2026-09-30',
    assigneeEmployeeId: 7,
}

function makeQueryClient() {
    return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

describe('useCreateTask', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.post).mockReset()
    })

    it('вызывает POST /v1/tasks с payload формы и возвращает id созданной задачи', async () => {
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: { id: 'task-1' } })
        const { result } = renderCreateTask(makeQueryClient())

        act(() => {
            result.current.mutate(PAYLOAD)
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(axiosInstance.post).toHaveBeenCalledWith('/v1/tasks', PAYLOAD)
        expect(result.current.data).toEqual({ id: 'task-1' })
    })

    it('оборачивает ошибку backend в ApiError с сообщением из тела ответа', async () => {
        vi.mocked(axiosInstance.post).mockRejectedValue({
            isAxiosError: true,
            response: { data: { message: 'Дедлайн должен быть в будущем' } },
        })
        const { result } = renderCreateTask(makeQueryClient())

        act(() => {
            result.current.mutate(PAYLOAD)
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error).toBeInstanceOf(ApiError)
        expect(result.current.error?.message).toBe('Дедлайн должен быть в будущем')
    })

    it('падает с общим сообщением, если backend не вернул message', async () => {
        vi.mocked(axiosInstance.post).mockRejectedValue(new Error('network down'))
        const { result } = renderCreateTask(makeQueryClient())

        act(() => {
            result.current.mutate(PAYLOAD)
        })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error?.message).toBe('Не удалось создать задачу')
    })
})
