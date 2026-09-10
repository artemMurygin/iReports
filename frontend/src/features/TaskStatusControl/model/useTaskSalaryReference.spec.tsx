import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Task } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { useTaskSalaryReference } from './useTaskSalaryReference.ts'

/**
 * add-task-salary-rule-links-comments, tasks.md 24.1: `useTaskSalaryReference(task)` ->
 * `{ rule, accrual, isLoading }` (design.md решение 3) — при заполненном `task.direction` запрашивает
 * только этот домен; при пустом — последовательно `service`, затем `shop`, первый непустой результат;
 * без связанного правила — `rule: null`.
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

function makeTask(direction: Task['direction']): Task {
    return {
        id: 'task-1',
        direction,
        title: 'Обновить фото витрины',
        description: null,
        deadline: new Date('2026-09-25'),
        assigneeEmployeeId: 42,
        status: 'IN_PROGRESS',
        closedSuccessfullyAt: null,
        createdAt: new Date('2026-09-01'),
        updatedAt: new Date('2026-09-01'),
    }
}

function renderWithClient(queryClient: QueryClient, task: Task) {
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useTaskSalaryReference(task), { wrapper })
}

const notFound = () =>
    Promise.reject({ isAxiosError: true, response: { status: 404 } })

describe('useTaskSalaryReference', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
    })

    it('queries only the service domain when task.direction is "service"', async () => {
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/service/accounting/salary-rules/by-task/task-1')
                return Promise.resolve({ data: { id: 'rule-1', name: 'Правило', type: 'TaskCompletion', targetRole: 'ENGINEER' } })
            if (url === '/v1/service/accounting/salary-accrual-lines/by-task/task-1')
                return Promise.resolve({ data: { id: 'line-1', amount: 1000, status: 'ACCRUED' } })
            return notFound()
        })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

        const { result } = renderWithClient(queryClient, makeTask('service'))

        await waitFor(() => expect(result.current.rule?.id).toBe('rule-1'))
        expect(result.current.accrual?.id).toBe('line-1')
        expect(vi.mocked(axiosInstance.get).mock.calls.some(([url]) => (url as string).includes('/shop/'))).toBe(
            false,
        )
    })

    it('does not query shop when direction is empty and service already found a rule', async () => {
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/service/accounting/salary-rules/by-task/task-1')
                return Promise.resolve({ data: { id: 'rule-service', name: 'Правило', type: 'TaskCompletion', targetRole: 'ENGINEER' } })
            if (url === '/v1/service/accounting/salary-accrual-lines/by-task/task-1') return notFound()
            return notFound()
        })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

        const { result } = renderWithClient(queryClient, makeTask(null))

        await waitFor(() => expect(result.current.rule?.id).toBe('rule-service'))
        expect(vi.mocked(axiosInstance.get).mock.calls.some(([url]) => (url as string).includes('/shop/'))).toBe(
            false,
        )
    })

    it('falls back to shop when direction is empty and service found no rule', async () => {
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/service/accounting/salary-rules/by-task/task-1') return notFound()
            if (url === '/v1/shop/accounting/salary-rules/by-task/task-1')
                return Promise.resolve({ data: { id: 'rule-shop', name: 'Правило', type: 'TaskCompletion', targetRole: 'ENGINEER' } })
            if (url === '/v1/shop/accounting/salary-accrual-lines/by-task/task-1')
                return Promise.resolve({ data: { id: 'line-shop', amount: 500, status: 'DRAFT' } })
            return notFound()
        })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

        const { result } = renderWithClient(queryClient, makeTask(null))

        await waitFor(() => expect(result.current.rule?.id).toBe('rule-shop'))
        expect(result.current.accrual?.id).toBe('line-shop')
        expect(axiosInstance.get).toHaveBeenCalledWith(
            '/v1/service/accounting/salary-rules/by-task/task-1',
            expect.anything(),
        )
    })

    it('resolves rule: null when neither service nor shop has a matching rule', async () => {
        vi.mocked(axiosInstance.get).mockImplementation(() => notFound())
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

        const { result } = renderWithClient(queryClient, makeTask(null))

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.rule).toBeNull()
        expect(result.current.accrual).toBeNull()
    })
})
