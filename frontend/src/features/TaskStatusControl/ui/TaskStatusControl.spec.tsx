import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Task } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { TaskStatusControl } from './TaskStatusControl.tsx'

// replace-bitrix-task-integration, tasks.md 12.1 — тест на `useTask`/`useTaskTransition` через
// сам компонент (по прецеденту `EmployeeBalance/ui/NewTransactionDrawer.spec.tsx`): мокаем
// axios-инстанс, а не сами хуки — так проверяется весь путь GET/PATCH -> реальный UI, а не
// implementation detail внутренних вызовов.
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: {
        get: vi.fn(),
        patch: vi.fn(),
    },
}))

const TASK_IN_PROGRESS: Task = {
    id: 'task-1',
    direction: 'service',
    title: 'Обновить фото витрины',
    description: 'Сфотографировать витрину и загрузить в CRM',
    deadline: new Date('2026-08-25'),
    assigneeEmployeeId: 42,
    status: 'IN_PROGRESS',
    closedSuccessfullyAt: null,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
}

function renderControl(taskId = 'task-1') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <TaskStatusControl taskId={taskId} />
        </QueryClientProvider>,
    )
}

describe('TaskStatusControl', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
        vi.mocked(axiosInstance.patch).mockReset()
    })

    it('loads the task via GET /v1/tasks/:id and renders its title and status', async () => {
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/tasks/task-1') return Promise.resolve({ data: TASK_IN_PROGRESS })
            if (url === '/v1/directory/employees') return Promise.resolve({ data: [] })
            return Promise.reject(new Error(`unexpected GET ${url}`))
        })

        renderControl()

        expect(await screen.findByText('Обновить фото витрины')).toBeInTheDocument()
        expect(screen.getByText('В работе')).toBeInTheDocument()
        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/tasks/task-1', expect.anything())
    })

    it("sends PATCH /v1/tasks/:id/status with the clicked action's targetStatus and refetches the task", async () => {
        const user = userEvent.setup()
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/tasks/task-1') return Promise.resolve({ data: TASK_IN_PROGRESS })
            if (url === '/v1/directory/employees') return Promise.resolve({ data: [] })
            return Promise.reject(new Error(`unexpected GET ${url}`))
        })
        vi.mocked(axiosInstance.patch).mockResolvedValueOnce({ data: { ...TASK_IN_PROGRESS, status: 'DONE' } })

        renderControl()
        await screen.findByText('Обновить фото витрины')

        await user.click(screen.getByRole('button', { name: /Отметить выполненной/ }))

        await waitFor(() =>
            expect(axiosInstance.patch).toHaveBeenCalledWith('/v1/tasks/task-1/status', { targetStatus: 'DONE' }),
        )
        // Успешная мутация инвалидирует ['tasks'] -> GET дергается ещё раз для этого же taskId.
        await waitFor(() => {
            const calls = vi.mocked(axiosInstance.get).mock.calls.filter(([url]) => url === '/v1/tasks/task-1')
            expect(calls.length).toBeGreaterThanOrEqual(2)
        })
    })

    it('shows no transition buttons for a terminal status (CLOSED_SUCCESSFULLY)', async () => {
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/tasks/task-1')
                return Promise.resolve({
                    data: { ...TASK_IN_PROGRESS, status: 'CLOSED_SUCCESSFULLY', closedSuccessfullyAt: new Date() },
                })
            if (url === '/v1/directory/employees') return Promise.resolve({ data: [] })
            return Promise.reject(new Error(`unexpected GET ${url}`))
        })

        renderControl()
        await screen.findByText('Обновить фото витрины')
        expect(
            screen.queryByRole('button', { name: /Закрыть успешно|Отметить выполненной|Взять в работу/ }),
        ).not.toBeInTheDocument()
    })
})
