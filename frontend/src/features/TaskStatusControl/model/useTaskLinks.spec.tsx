import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { TaskLink } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { useTaskLinks } from './useTaskLinks.ts'

/**
 * add-task-salary-rule-links-comments, tasks.md 23.1: `useTaskLinks(taskId)` ->
 * `{ links, addLink, removeLink, error }`. `spec: tasks/links#Requirement: Ссылка должна быть
 * валидным адресом` — `addLink` отклоняет невалидный URL до отправки на сервер.
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const LINK: TaskLink = {
    id: 'link-1',
    taskId: 'task-1',
    url: 'https://example.com/report.pdf',
    label: 'Отчёт',
    createdAt: new Date('2026-09-01T10:00:00Z'),
}

function renderWithClient(queryClient: QueryClient, taskId = 'task-1') {
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useTaskLinks(taskId), { wrapper })
}

describe('useTaskLinks', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
        vi.mocked(axiosInstance.post).mockReset()
        vi.mocked(axiosInstance.delete).mockReset()
    })

    it('returns the list of links loaded from GET /v1/tasks/:id/links', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: [LINK] })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

        const { result } = renderWithClient(queryClient)

        await waitFor(() => expect(result.current.links).toEqual([LINK]))
        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/tasks/task-1/links', expect.anything())
    })

    it('addLink posts a valid url and invalidates the links list', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: [] })
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: LINK })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderWithClient(queryClient)
        await waitFor(() => expect(result.current.links).toEqual([]))

        act(() => result.current.addLink('https://example.com/report.pdf', 'Отчёт'))

        await waitFor(() =>
            expect(axiosInstance.post).toHaveBeenCalledWith('/v1/tasks/task-1/links', {
                url: 'https://example.com/report.pdf',
                label: 'Отчёт',
            }),
        )
        await waitFor(() =>
            expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['task-links', 'task-1'] })),
        )
    })

    it('rejects an invalid url before sending it to the API', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: [] })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

        const { result } = renderWithClient(queryClient)
        await waitFor(() => expect(result.current.links).toEqual([]))

        act(() => result.current.addLink('not-a-url'))

        await waitFor(() => expect(result.current.error).toBeTruthy())
        expect(axiosInstance.post).not.toHaveBeenCalled()
    })

    it('removeLink deletes the link and invalidates the links list', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: [LINK] })
        vi.mocked(axiosInstance.delete).mockResolvedValue({ data: undefined })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderWithClient(queryClient)
        await waitFor(() => expect(result.current.links).toEqual([LINK]))

        act(() => result.current.removeLink('link-1'))

        await waitFor(() => expect(axiosInstance.delete).toHaveBeenCalledWith('/v1/tasks/task-1/links/link-1'))
        await waitFor(() =>
            expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['task-links', 'task-1'] })),
        )
    })
})
