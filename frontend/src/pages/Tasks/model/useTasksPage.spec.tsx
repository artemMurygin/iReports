import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Task } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { useTasksPage } from './useTasksPage.ts'

// replace-bitrix-task-integration, tasks.md 13.1 — плоский стейт-хук страницы `/tasks`:
// tasks/isInitialLoad/isRefreshing/statusFilter/setStatusFilter + аналогичный фильтр по
// направлению; смена фильтра не «схлопывает» уже отрисованный список (isInitialLoad/isRefreshing,
// тот же приём, что в других списковых страницах проекта — frontend/CLAUDE.md). Мокаем
// axios-инстанс (не `model/api.ts`), тот же приём, что `useSalesPlanPage.spec.tsx`/
// `TaskStatusControl.spec.tsx` — так проверяется реальный путь `GET /v1/tasks?status&direction`.
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn() },
}))

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        id: 'task-1',
        direction: 'service',
        title: 'Обзвонить клиентов после диагностики',
        description: null,
        deadline: new Date('2026-09-08'),
        assigneeEmployeeId: 42,
        status: 'NEW',
        closedSuccessfullyAt: null,
        createdAt: new Date('2026-08-01'),
        updatedAt: new Date('2026-08-01'),
        ...overrides,
    }
}

function renderTasksPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useTasksPage(), { wrapper })
}

/** Extracts `status`/`direction` from every `GET /v1/tasks` call so assertions can check exactly
 * what query params each filter change actually sent. */
function readTasksCalls(): { status?: string; direction?: string }[] {
    return vi
        .mocked(axiosInstance.get)
        .mock.calls.filter(([url]) => url === '/v1/tasks')
        .map(([, config]) => (config as { params?: { status?: string; direction?: string } })?.params ?? {})
}

describe('useTasksPage', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
    })

    it('starts with isInitialLoad and no tasks, then loads the unfiltered list', async () => {
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/tasks') return Promise.resolve({ data: [makeTask()] })
            if (url === '/v1/directory/employees') return Promise.resolve({ data: [] })
            return Promise.reject(new Error(`unexpected GET ${url}`))
        })

        const { result } = renderTasksPage()

        expect(result.current.isInitialLoad).toBe(true)
        expect(result.current.tasks).toEqual([])

        await waitFor(() => expect(result.current.tasks).toHaveLength(1))
        expect(result.current.isInitialLoad).toBe(false)
        expect(result.current.isRefreshing).toBe(false)

        // Both filters default to 'all' — no status/direction sent on the first request.
        expect(readTasksCalls()[0]).toEqual({})
    })

    it('setStatusFilter refetches with ?status=... without clearing the already-rendered list (isRefreshing, not isInitialLoad)', async () => {
        let resolveSecondCall: ((value: { data: Task[] }) => void) | undefined
        vi.mocked(axiosInstance.get).mockImplementation((url: string, config?: { params?: { status?: string } }) => {
            if (url === '/v1/directory/employees') return Promise.resolve({ data: [] })
            if (url !== '/v1/tasks') return Promise.reject(new Error(`unexpected GET ${url}`))
            if (config?.params?.status === 'DONE') {
                return new Promise((resolve) => {
                    resolveSecondCall = resolve
                })
            }
            return Promise.resolve({ data: [makeTask({ id: 'task-1' })] })
        })

        const { result } = renderTasksPage()
        await waitFor(() => expect(result.current.tasks).toHaveLength(1))

        result.current.setStatusFilter('DONE')

        // The filtered request is in flight (deliberately unresolved above) — the old list is
        // still shown, and the flag distinguishing this from the first load is isRefreshing.
        await waitFor(() => expect(result.current.isRefreshing).toBe(true))
        expect(result.current.isInitialLoad).toBe(false)
        expect(result.current.tasks).toHaveLength(1)
        expect(result.current.tasks[0].id).toBe('task-1')

        resolveSecondCall?.({ data: [makeTask({ id: 'task-2', status: 'DONE' })] })

        await waitFor(() => expect(result.current.tasks[0]?.id).toBe('task-2'))
        expect(result.current.isRefreshing).toBe(false)
        expect(readTasksCalls().some((params) => params.status === 'DONE')).toBe(true)
    })

    it('setDirectionFilter sends ?direction=shop', async () => {
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/directory/employees') return Promise.resolve({ data: [] })
            if (url === '/v1/tasks') return Promise.resolve({ data: [] })
            return Promise.reject(new Error(`unexpected GET ${url}`))
        })

        const { result } = renderTasksPage()
        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))

        result.current.setDirectionFilter('shop')

        await waitFor(() => expect(readTasksCalls().some((params) => params.direction === 'shop')).toBe(true))
    })

    it('search filters the already-loaded list locally by title, without an extra request', async () => {
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/directory/employees') return Promise.resolve({ data: [] })
            if (url === '/v1/tasks') {
                return Promise.resolve({
                    data: [
                        makeTask({ id: 'task-1', title: 'Обновить фото витрины' }),
                        makeTask({ id: 'task-2', title: 'Провести инвентаризацию склада' }),
                    ],
                })
            }
            return Promise.reject(new Error(`unexpected GET ${url}`))
        })

        const { result } = renderTasksPage()
        await waitFor(() => expect(result.current.tasks).toHaveLength(2))

        const callsBeforeSearch = readTasksCalls().length
        result.current.setSearch('витрины')

        await waitFor(() => expect(result.current.tasks).toHaveLength(1))
        expect(result.current.tasks[0].id).toBe('task-1')
        expect(readTasksCalls()).toHaveLength(callsBeforeSearch)
    })

    it('reports an empty tasks list when the filtered result is empty (drives the empty-state screen)', async () => {
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/directory/employees') return Promise.resolve({ data: [] })
            if (url === '/v1/tasks') return Promise.resolve({ data: [] })
            return Promise.reject(new Error(`unexpected GET ${url}`))
        })

        const { result } = renderTasksPage()

        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))
        expect(result.current.tasks).toEqual([])
        expect(result.current.hasTasks).toBe(false)
    })
})
