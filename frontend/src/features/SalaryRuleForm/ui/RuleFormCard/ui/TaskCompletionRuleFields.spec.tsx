import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
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
    api: { get: vi.fn(), delete: vi.fn() },
}))

// Radix `Select` (deadlinePeriodOffset) вызывает `hasPointerCapture`/`releasePointerCapture`/
// `scrollIntoView` при открытии — jsdom их не реализует. Тот же полифилл, что и
// `WarehouseSelect.spec.tsx`/`EditTaskFields.spec.tsx`.
beforeAll(() => {
    window.HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
    window.HTMLElement.prototype.releasePointerCapture = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

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
        vi.mocked(axiosInstance.delete).mockReset()
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
        // recurring-task-deadline-offset v2 — одно поле «Дедлайн» (день + смещение периода)
        // вместо прежних двух разрозненных.
        expect(screen.queryByLabelText('Дедлайн')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Дедлайн относится к')).not.toBeInTheDocument()
    })

    it('shows the auto-recreate template fields for a recurring rule and reports edits', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        renderField({ draft: makeDraft({ isRecurring: true, taskTitleTemplate: '' }), onChange })

        const titleTemplate = screen.getByLabelText('Заголовок задачи')
        expect(titleTemplate).toBeInTheDocument()
        expect(screen.getByLabelText('Описание задачи')).toBeInTheDocument()
        // recurring-task-deadline-offset v2 — единое поле «Дедлайн» (день месяца + селект
        // смещения периода, см. describe ниже за детальным покрытием).
        expect(screen.getByLabelText('Дедлайн')).toBeInTheDocument()
        expect(screen.getByLabelText('Дедлайн относится к')).toBeInTheDocument()

        await user.type(titleTemplate, 'X')

        expect(onChange).toHaveBeenCalledWith({ taskTitleTemplate: 'X' })
    })

    // recurring-task-deadline-offset v2, Pencil node `Zp9oG` (фрейм `T0d2zv`) — одно поле
    // «Дедлайн» (день + «‹день› числа · ‹смещение›») с живым примером вместо прежней полной
    // календарной даты и разрозненного select'а (node `B7KIJL`, фрейм `MC9n1`, сравнение).
    describe('поле «Дедлайн» (день месяца + смещение периода)', () => {
        it('показывает день из deadlineTemplate, выбранное смещение и живой пример', () => {
            renderField({
                draft: makeDraft({
                    isRecurring: true,
                    deadlineTemplate: '2000-01-25',
                    deadlinePeriodOffset: 1,
                    accountingPeriod: '2026-01',
                }),
            })

            expect(screen.getByLabelText('Дедлайн')).toHaveValue('25')
            expect(screen.getByLabelText('Дедлайн относится к')).toHaveTextContent('в следующем периоде')
            expect(screen.getByText('Например: 25 февраля — для задачи за январь')).toBeInTheDocument()
        })

        it('зажимает пример по длине целевого месяца (31 число со смещением в короткий месяц)', () => {
            renderField({
                draft: makeDraft({
                    isRecurring: true,
                    deadlineTemplate: '2000-01-31',
                    deadlinePeriodOffset: 1,
                    accountingPeriod: '2026-01',
                }),
            })

            expect(screen.getByText('Например: 28 февраля — для задачи за январь')).toBeInTheDocument()
        })

        it('не показывает пример, пока день ещё не введён', () => {
            renderField({
                draft: makeDraft({ isRecurring: true, deadlineTemplate: '', accountingPeriod: '2026-01' }),
            })

            expect(screen.queryByText(/Например:/)).not.toBeInTheDocument()
        })

        it('строит канонический носитель дня без ведущего нуля по мере набора', async () => {
            const user = userEvent.setup()
            const onChange = vi.fn()
            renderField({ draft: makeDraft({ isRecurring: true, deadlineTemplate: '' }), onChange })

            await user.type(screen.getByLabelText('Дедлайн'), '5')

            expect(onChange).toHaveBeenCalledWith({ deadlineTemplate: '2000-01-5' })
        })

        it('меняет смещение периода через select', async () => {
            const user = userEvent.setup()
            const onChange = vi.fn()
            renderField({
                draft: makeDraft({ isRecurring: true, deadlineTemplate: '2000-01-10', deadlinePeriodOffset: 0 }),
                onChange,
            })

            await user.click(screen.getByLabelText('Дедлайн относится к'))
            await user.click(screen.getByRole('option', { name: 'через 2 периода' }))

            expect(onChange).toHaveBeenCalledWith({ deadlinePeriodOffset: 2 })
        })
    })

    // add-task-rule-task-lifecycle
    describe('шаблон ссылок для новой задачи периода', () => {
        it('не рендерится для разового правила', () => {
            renderField({ draft: makeDraft({ isRecurring: false }) })

            expect(screen.queryByText('Ссылки для новой задачи периода')).not.toBeInTheDocument()
        })

        it('добавляет ссылку в taskLinkTemplates для регулярного правила', async () => {
            const user = userEvent.setup()
            const onChange = vi.fn()
            renderField({ draft: makeDraft({ isRecurring: true, taskLinkTemplates: [] }), onChange })

            await user.click(screen.getByRole('button', { name: 'Добавить' }))
            await user.type(screen.getByLabelText('Адрес ссылки'), 'https://example.com/report')
            await user.click(screen.getByRole('button', { name: 'Добавить ссылку' }))

            expect(onChange).toHaveBeenCalledWith({
                taskLinkTemplates: [{ url: 'https://example.com/report', label: undefined }],
            })
        })

        it('показывает уже добавленные ссылки и удаляет их по клику', async () => {
            const user = userEvent.setup()
            const onChange = vi.fn()
            renderField({
                draft: makeDraft({
                    isRecurring: true,
                    taskLinkTemplates: [{ url: 'https://example.com/1', label: 'Отчёт' }],
                }),
                onChange,
            })

            expect(screen.getByText('Отчёт')).toBeInTheDocument()

            await user.click(screen.getByRole('button', { name: 'Удалить ссылку' }))

            expect(onChange).toHaveBeenCalledWith({ taskLinkTemplates: [] })
        })
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

    // add-task-rule-task-lifecycle: "Удалить задачу" полностью удаляет привязанную задачу
    // (DELETE /v1/tasks/:id) и очищает draft.taskId, а не просто отвязывает её локально.
    describe('удаление привязанной задачи', () => {
        it('запрашивает подтверждение и удаляет задачу по клику на "Удалить"', async () => {
            vi.mocked(axiosInstance.get).mockResolvedValue({ data: { id: 'task-42', title: 'Обновить фото витрины' } })
            vi.mocked(axiosInstance.delete).mockResolvedValue({ data: undefined })
            const onChange = vi.fn()
            const user = userEvent.setup()
            renderField({ draft: makeDraft(), onChange })
            await waitFor(() => expect(screen.getByText('Обновить фото витрины')).toBeInTheDocument())

            await user.click(screen.getByRole('button', { name: 'Удалить задачу' }))
            expect(axiosInstance.delete).not.toHaveBeenCalled()
            expect(screen.getByText('Удалить задачу «Обновить фото витрины»?')).toBeInTheDocument()

            await user.click(screen.getByRole('button', { name: 'Удалить' }))

            await waitFor(() => expect(axiosInstance.delete).toHaveBeenCalledWith('/v1/tasks/task-42'))
            await waitFor(() => expect(onChange).toHaveBeenCalledWith({ taskId: '' }))
        })

        it('не удаляет задачу и не меняет draft, если отменить подтверждение', async () => {
            vi.mocked(axiosInstance.get).mockResolvedValue({ data: { id: 'task-42', title: 'Обновить фото витрины' } })
            const onChange = vi.fn()
            const user = userEvent.setup()
            renderField({ draft: makeDraft(), onChange })
            await waitFor(() => expect(screen.getByText('Обновить фото витрины')).toBeInTheDocument())

            await user.click(screen.getByRole('button', { name: 'Удалить задачу' }))
            await user.click(screen.getByRole('button', { name: 'Отмена' }))

            expect(axiosInstance.delete).not.toHaveBeenCalled()
            expect(onChange).not.toHaveBeenCalled()
            expect(screen.queryByText('Удалить задачу «Обновить фото витрины»?')).not.toBeInTheDocument()
        })
    })

    // add-task-rule-task-lifecycle: для уже сохранённого правила (draft.ruleId задан) "Удалить
    // задачу" не может просто очистить draft.taskId — правило TaskCompletion без задачи не может
    // существовать персистентно, поэтому удаляется правило целиком, немедленно, через onDeleteRule.
    describe('удаление задачи уже сохранённого правила (draft.ruleId задан)', () => {
        it('вызывает onDeleteRule и onRuleRemoved вместо прямого удаления задачи', async () => {
            vi.mocked(axiosInstance.get).mockResolvedValue({ data: { id: 'task-42', title: 'Обновить фото витрины' } })
            const onChange = vi.fn()
            const onDeleteRule = vi.fn().mockResolvedValue(undefined)
            const onRuleRemoved = vi.fn()
            const user = userEvent.setup()
            const draft = makeDraft({ ruleId: 'rule-1' })
            renderField({ draft, onChange, onDeleteRule, onRuleRemoved })
            await waitFor(() => expect(screen.getByText('Обновить фото витрины')).toBeInTheDocument())

            await user.click(screen.getByRole('button', { name: 'Удалить задачу' }))
            expect(screen.getByText('Удалить задачу «Обновить фото витрины» вместе с правилом?')).toBeInTheDocument()

            await user.click(screen.getByRole('button', { name: 'Удалить' }))

            await waitFor(() => expect(onDeleteRule).toHaveBeenCalledWith('rule-1'))
            await waitFor(() => expect(onRuleRemoved).toHaveBeenCalledTimes(1))
            expect(axiosInstance.delete).not.toHaveBeenCalled()
            expect(onChange).not.toHaveBeenCalledWith({ taskId: '' })
        })

        it('показывает ошибку и не вызывает onRuleRemoved, если onDeleteRule падает', async () => {
            vi.mocked(axiosInstance.get).mockResolvedValue({ data: { id: 'task-42', title: 'Обновить фото витрины' } })
            const onDeleteRule = vi.fn().mockRejectedValue(new Error('Сеть недоступна'))
            const onRuleRemoved = vi.fn()
            const user = userEvent.setup()
            renderField({ draft: makeDraft({ ruleId: 'rule-1' }), onDeleteRule, onRuleRemoved })
            await waitFor(() => expect(screen.getByText('Обновить фото витрины')).toBeInTheDocument())

            await user.click(screen.getByRole('button', { name: 'Удалить задачу' }))
            await user.click(screen.getByRole('button', { name: 'Удалить' }))

            await waitFor(() => expect(screen.getByText(/Сеть недоступна/)).toBeInTheDocument())
            expect(onRuleRemoved).not.toHaveBeenCalled()
        })
    })
})
