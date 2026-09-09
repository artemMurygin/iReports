import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'
import { createRuleDraft } from '../../../model/ruleDraft.ts'
import type { RuleDraft } from '../../../model/ruleDraft.ts'

import { TaskCompletionRuleFields, type TaskCompletionRuleFieldsProps } from './TaskCompletionRuleFields.tsx'

/**
 * replace-bitrix-task-integration — "Задача" is now either a "Создать задачу" button
 * (`draft.taskId === ''`, calls `onCreateTask`) or a clickable widget showing the linked task's
 * TITLE (fetched via `useRuleTask`'s own `GET /v1/tasks/:id`, not the raw id — see
 * `TaskCompletionRuleFields.tsx`'s own WHY), calling `onOpenTask` — both callbacks bubble up to
 * whichever page renders the create/details side panels (`features/CreateTask`'s `CreateTaskPanel`/
 * `features/TaskStatusControl`'s `TaskDetailsPanel`), which this component itself can't import
 * (cross-feature import forbidden, frontend/CLAUDE.md). `taskTitleTemplate`/
 * `taskDescriptionTemplate`/`deadlineTemplate` remain separate form fields, visible only when
 * `isRecurring === true`.
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn() },
}))

function makeDraft(patch: Partial<RuleDraft> = {}): RuleDraft {
    return { ...createRuleDraft('TaskCompletion'), taskId: 'task-42', ...patch }
}

function renderField(props: Partial<TaskCompletionRuleFieldsProps> & { draft: RuleDraft }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <QueryClientProvider client={queryClient}>
            <TaskCompletionRuleFields errors={{}} onChange={vi.fn()} {...props} />
        </QueryClientProvider>,
    )
}

describe('TaskCompletionRuleFields', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
    })

    it('shows the linked task title (not its id) once it loads, and opens the details panel on click', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: { id: 'task-42', title: 'Обновить фото витрины' } })
        const onOpenTask = vi.fn()
        const user = userEvent.setup()
        renderField({ draft: makeDraft(), onOpenTask })

        expect(screen.getByText('Загрузка…')).toBeInTheDocument()
        await waitFor(() => expect(screen.getByText('Обновить фото витрины')).toBeInTheDocument())
        expect(screen.queryByText(/task-42/)).not.toBeInTheDocument()

        await user.click(screen.getByText('Обновить фото витрины'))
        expect(onOpenTask).toHaveBeenCalledWith('task-42')
    })

    it('shows a "Создать задачу" button instead when there is no task yet, and requests creation on click', async () => {
        const onCreateTask = vi.fn()
        const user = userEvent.setup()
        const draft = makeDraft({ taskId: '' })
        renderField({ draft, onCreateTask })

        const button = screen.getByRole('button', { name: 'Создать задачу' })
        await user.click(button)

        expect(onCreateTask).toHaveBeenCalledWith(draft.draftId)
        expect(axiosInstance.get).not.toHaveBeenCalled()
    })

    it('hides the auto-recreate template fields for a one-off rule (isRecurring: false)', () => {
        renderField({ draft: makeDraft({ isRecurring: false }) })

        expect(screen.queryByLabelText('Заголовок задачи')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Описание задачи')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Дедлайн шаблона')).not.toBeInTheDocument()
    })

    it('shows the auto-recreate template fields for a recurring rule and reports edits', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        renderField({ draft: makeDraft({ isRecurring: true, taskTitleTemplate: '' }), onChange })

        const titleTemplate = screen.getByLabelText('Заголовок задачи')
        expect(titleTemplate).toBeInTheDocument()
        expect(screen.getByLabelText('Описание задачи')).toBeInTheDocument()
        expect(screen.getByLabelText('Дедлайн шаблона')).toBeInTheDocument()

        await user.type(titleTemplate, 'X')

        expect(onChange).toHaveBeenCalledWith({ taskTitleTemplate: 'X' })
    })

    it('toggles isRecurring via the period tabs', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        renderField({ draft: makeDraft({ isRecurring: false }), onChange })

        await user.click(screen.getByRole('tab', { name: 'Регулярная' }))

        expect(onChange).toHaveBeenCalledWith({ isRecurring: true })
    })

    it('still renders the default-amount field and surfaces its error', () => {
        renderField({
            draft: makeDraft({ price: '5000' }),
            errors: { price: 'Укажите сумму начисления по умолчанию' },
        })

        expect(screen.getByDisplayValue('5000')).toBeInTheDocument()
        expect(screen.getByText('Укажите сумму начисления по умолчанию')).toBeInTheDocument()
    })

    it('surfaces the taskId error when it is somehow empty', () => {
        renderField({
            draft: makeDraft({ taskId: '' }),
            errors: { taskId: 'Задача ещё не создана' },
        })

        expect(screen.getByText('Задача ещё не создана')).toBeInTheDocument()
    })
})
