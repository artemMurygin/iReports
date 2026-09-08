import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createRuleDraft } from '../../../model/ruleDraft.ts'
import type { RuleDraft } from '../../../model/ruleDraft.ts'

import { TaskCompletionRuleFields } from './TaskCompletionRuleFields.tsx'

/**
 * replace-bitrix-task-integration, раздел 14 tasks.md (14.5) — `taskId` теперь ОБЯЗАТЕЛЬНЫЙ
 * readonly-параметр (приходит от мастера, шаг 1), а `taskTitleTemplate`/`taskDescriptionTemplate`/
 * `deadlineTemplate` — отдельные поля формы, видимые только при `isRecurring === true` (см.
 * ui-design.md "Ключевые состояния экранов", вариант `EdCuh`).
 */
function makeDraft(patch: Partial<RuleDraft> = {}): RuleDraft {
    return { ...createRuleDraft('TaskCompletion'), taskId: 'task-42', ...patch }
}

describe('TaskCompletionRuleFields', () => {
    it('shows the taskId from the wizard as a readonly value, not a text input', () => {
        render(<TaskCompletionRuleFields draft={makeDraft()} errors={{}} onChange={vi.fn()} />)

        expect(screen.getByText(/task-42/)).toBeInTheDocument()
        expect(screen.queryByRole('textbox', { name: /задач/i })).not.toBeInTheDocument()
    })

    it('hides the auto-recreate template fields for a one-off rule (isRecurring: false)', () => {
        render(<TaskCompletionRuleFields draft={makeDraft({ isRecurring: false })} errors={{}} onChange={vi.fn()} />)

        expect(screen.queryByLabelText('Заголовок задачи')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Описание задачи')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Дедлайн шаблона')).not.toBeInTheDocument()
    })

    it('shows the auto-recreate template fields for a recurring rule and reports edits', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        render(
            <TaskCompletionRuleFields
                draft={makeDraft({ isRecurring: true, taskTitleTemplate: '' })}
                errors={{}}
                onChange={onChange}
            />,
        )

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
        render(<TaskCompletionRuleFields draft={makeDraft({ isRecurring: false })} errors={{}} onChange={onChange} />)

        await user.click(screen.getByRole('tab', { name: 'Регулярная' }))

        expect(onChange).toHaveBeenCalledWith({ isRecurring: true })
    })

    it('still renders the default-amount field and surfaces its error', () => {
        render(
            <TaskCompletionRuleFields
                draft={makeDraft({ price: '5000' })}
                errors={{ price: 'Укажите сумму начисления по умолчанию' }}
                onChange={vi.fn()}
            />,
        )

        expect(screen.getByDisplayValue('5000')).toBeInTheDocument()
        expect(screen.getByText('Укажите сумму начисления по умолчанию')).toBeInTheDocument()
    })

    it('surfaces the taskId error (wizard regression guard) when it is somehow empty', () => {
        render(
            <TaskCompletionRuleFields
                draft={makeDraft({ taskId: '' })}
                errors={{ taskId: 'Задача ещё не создана — пройдите Шаг 1 мастера' }}
                onChange={vi.fn()}
            />,
        )

        expect(screen.getByText('Задача ещё не создана — пройдите Шаг 1 мастера')).toBeInTheDocument()
    })
})
