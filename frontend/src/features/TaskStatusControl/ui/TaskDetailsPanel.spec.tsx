import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { SalaryRuleSummary, Task } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { TaskDetailsPanel } from './TaskDetailsPanel.tsx'

// add-task-salary-rule-links-comments, tasks.md 27.1 — `TaskDetailsPanel` принимает новый
// опциональный `onOpenSalaryRule?`, прокинутый насквозь в `TaskStatusControl` (group 27.3).
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const TASK: Task = {
    id: 'task-1',
    direction: 'service',
    title: 'Обновить фото витрины',
    description: null,
    deadline: new Date('2026-08-25'),
    assigneeEmployeeId: 42,
    status: 'IN_PROGRESS',
    closedSuccessfullyAt: null,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
}

const RULE: SalaryRuleSummary = { id: 'rule-1', name: 'Задача: Обновить фото витрины', type: 'TaskCompletion', targetRole: 'ENGINEER' }

function mockTaskWithRule() {
    vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
        if (url === '/v1/tasks/task-1') return Promise.resolve({ data: TASK })
        if (url === '/v1/directory/employees') return Promise.resolve({ data: [] })
        if (url === '/v1/tasks/task-1/comments') return Promise.resolve({ data: [] })
        if (url === '/v1/tasks/task-1/links') return Promise.resolve({ data: [] })
        if (url === '/v1/service/accounting/salary-rules/by-task/task-1') return Promise.resolve({ data: RULE })
        return Promise.reject({ isAxiosError: true, response: { status: 404 } })
    })
}

function renderPanel(onOpenSalaryRule?: (args: { ruleId: string; direction: 'service' | 'shop' }) => void) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
        <QueryClientProvider client={queryClient}>
            <TaskDetailsPanel taskId="task-1" onClose={vi.fn()} onOpenSalaryRule={onOpenSalaryRule} />
        </QueryClientProvider>,
    )
}

describe('TaskDetailsPanel', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
    })

    it('без onOpenSalaryRule прокидывает undefined, блок правила некликабелен', async () => {
        mockTaskWithRule()
        renderPanel()

        expect(await screen.findByText('Задача: Обновить фото витрины')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /Задача: Обновить фото витрины/ })).not.toBeInTheDocument()
    })

    it('с onOpenSalaryRule клик по блоку правила вызывает колбэк', async () => {
        const user = userEvent.setup()
        const onOpenSalaryRule = vi.fn()
        mockTaskWithRule()
        renderPanel(onOpenSalaryRule)

        await screen.findByText('Задача: Обновить фото витрины')
        await user.click(screen.getByRole('button', { name: /Задача: Обновить фото витрины/ }))

        expect(onOpenSalaryRule).toHaveBeenCalledWith({ ruleId: 'rule-1', direction: 'service' })
    })

    // Поле комментария рендерится через `SidePanel`'s `footer` (`TaskCommentComposerContainer`), не
    // внутри `TaskStatusControl` — этот тест проверяет именно эту точку интеграции, не дублируя
    // `TaskCommentComposer.spec.tsx`'s юнит-тесты валидации/очистки поля.
    it('поле комментария в футере отправляет POST /v1/tasks/:id/comments', async () => {
        const user = userEvent.setup()
        mockTaskWithRule()
        vi.mocked(axiosInstance.post).mockResolvedValueOnce({ data: {} })
        renderPanel()

        await screen.findByText('Задача: Обновить фото витрины')
        await user.type(screen.getByLabelText('Написать комментарий'), 'Проверка футера')
        await user.click(screen.getByRole('button', { name: /Отправить/ }))

        expect(axiosInstance.post).toHaveBeenCalledWith('/v1/tasks/task-1/comments', { text: 'Проверка футера' })
    })
})
