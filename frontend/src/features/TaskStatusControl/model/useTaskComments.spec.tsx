import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { TaskComment } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { useTaskComments } from './useTaskComments.ts'

/**
 * add-task-salary-rule-links-comments, tasks.md 22.1: `useTaskComments(taskId)` ->
 * `{ comments, addComment, isAdding, error }`. `spec: tasks/comments#Requirement: Пустой комментарий
 * отклоняется` — пустой/пробельный текст не должен уходить в POST.
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const COMMENT: TaskComment = {
    id: 'comment-1',
    taskId: 'task-1',
    authorEmployeeId: 42,
    text: 'Готово, проверьте',
    createdAt: new Date('2026-09-01T10:00:00Z'),
}

function renderWithClient(queryClient: QueryClient, taskId = 'task-1') {
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useTaskComments(taskId), { wrapper })
}

describe('useTaskComments', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
        vi.mocked(axiosInstance.post).mockReset()
    })

    it('returns the list of comments loaded from GET /v1/tasks/:id/comments', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: [COMMENT] })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

        const { result } = renderWithClient(queryClient)

        await waitFor(() => expect(result.current.comments).toEqual([COMMENT]))
        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/tasks/task-1/comments', expect.anything())
    })

    it('addComment posts the text and invalidates the comments list', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: [] })
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: COMMENT })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderWithClient(queryClient)
        await waitFor(() => expect(result.current.comments).toEqual([]))

        act(() => result.current.addComment('Готово, проверьте'))

        await waitFor(() =>
            expect(axiosInstance.post).toHaveBeenCalledWith('/v1/tasks/task-1/comments', {
                text: 'Готово, проверьте',
            }),
        )
        await waitFor(() =>
            expect(invalidateSpy).toHaveBeenCalledWith(
                expect.objectContaining({ queryKey: ['task-comments', 'task-1'] }),
            ),
        )
    })

    it('rejects an empty/whitespace-only comment before sending it to the API', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: [] })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

        const { result } = renderWithClient(queryClient)
        await waitFor(() => expect(result.current.comments).toEqual([]))

        act(() => result.current.addComment('   '))

        await waitFor(() => expect(result.current.error).toBeTruthy())
        expect(axiosInstance.post).not.toHaveBeenCalled()
    })

    it('exposes isAdding while the mutation is in flight', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: [] })
        let resolvePost!: (v: { data: TaskComment }) => void
        vi.mocked(axiosInstance.post).mockReturnValue(
            new Promise((resolve) => {
                resolvePost = resolve
            }),
        )
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

        const { result } = renderWithClient(queryClient)
        await waitFor(() => expect(result.current.comments).toEqual([]))

        act(() => result.current.addComment('Готово'))
        await waitFor(() => expect(result.current.isAdding).toBe(true))

        resolvePost({ data: COMMENT })
        await waitFor(() => expect(result.current.isAdding).toBe(false))
    })
})
