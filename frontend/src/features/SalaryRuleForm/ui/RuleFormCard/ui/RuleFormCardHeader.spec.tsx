import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createRuleDraft } from '../../../model/ruleDraft.ts'
import type { RuleDraft } from '../../../model/ruleDraft.ts'

import { RuleFormCardHeader, type RuleFormCardHeaderProps } from './RuleFormCardHeader.tsx'

/**
 * add-deactivate-salary-rule — «Деактивировать правило» (soft-delete уже сохранённого правила через
 * `onDeactivateRule`, любой тип, в отличие от `onDeleteRule`, доступного только `TaskCompletion`
 * из `TaskCompletionRuleFields.spec.tsx`, чей стиль тестов — confirm-диалог, mock async-колбэка,
 * userEvent — этот файл повторяет). Диалог намеренно не должен упоминать задачу — деактивация её
 * не трогает.
 */
function makeDraft(patch: Partial<RuleDraft> = {}): RuleDraft {
    return { ...createRuleDraft('PayPerHour'), name: 'Ставка за час', ruleId: 'rule-1', ...patch }
}

function renderHeader(props: Partial<RuleFormCardHeaderProps> & { draft: RuleDraft }) {
    return render(<RuleFormCardHeader index={0} categories={[]} onCancel={vi.fn()} onDelete={vi.fn()} {...props} />)
}

describe('RuleFormCardHeader', () => {
    it('не рендерит кнопку "Деактивировать" для ещё не сохранённого правила (draft.ruleId не задан)', () => {
        renderHeader({ draft: makeDraft({ ruleId: undefined }), onDeactivateRule: vi.fn() })

        expect(screen.queryByRole('button', { name: 'Деактивировать правило' })).not.toBeInTheDocument()
    })

    it('не рендерит кнопку "Деактивировать", когда родитель не передал onDeactivateRule', () => {
        renderHeader({ draft: makeDraft() })

        expect(screen.queryByRole('button', { name: 'Деактивировать правило' })).not.toBeInTheDocument()
    })

    it('запрашивает подтверждение без упоминания задачи и деактивирует правило по клику на "Деактивировать"', async () => {
        const onDeactivateRule = vi.fn().mockResolvedValue(undefined)
        const onDelete = vi.fn()
        const user = userEvent.setup()
        renderHeader({ draft: makeDraft(), onDeactivateRule, onDelete })

        await user.click(screen.getByRole('button', { name: 'Деактивировать правило' }))
        expect(onDeactivateRule).not.toHaveBeenCalled()
        expect(screen.getByText('Деактивировать правило «Ставка за час»?')).toBeInTheDocument()
        expect(screen.getByText('Правило будет деактивировано и перестанет участвовать в расчётах.')).toBeInTheDocument()
        expect(screen.queryByText(/задач/i)).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Деактивировать' }))

        await waitFor(() => expect(onDeactivateRule).toHaveBeenCalledWith('rule-1'))
        await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1))
    })

    it('не деактивирует правило и не меняет карточку, если отменить подтверждение', async () => {
        const onDeactivateRule = vi.fn()
        const onDelete = vi.fn()
        const user = userEvent.setup()
        renderHeader({ draft: makeDraft(), onDeactivateRule, onDelete })

        await user.click(screen.getByRole('button', { name: 'Деактивировать правило' }))
        await user.click(screen.getByRole('button', { name: 'Отмена' }))

        expect(onDeactivateRule).not.toHaveBeenCalled()
        expect(onDelete).not.toHaveBeenCalled()
        expect(screen.queryByText('Деактивировать правило «Ставка за час»?')).not.toBeInTheDocument()
    })

    it('показывает ошибку и не убирает карточку, если onDeactivateRule падает', async () => {
        const onDeactivateRule = vi.fn().mockRejectedValue(new Error('Сеть недоступна'))
        const onDelete = vi.fn()
        const user = userEvent.setup()
        renderHeader({ draft: makeDraft(), onDeactivateRule, onDelete })

        await user.click(screen.getByRole('button', { name: 'Деактивировать правило' }))
        await user.click(screen.getByRole('button', { name: 'Деактивировать' }))

        await waitFor(() => expect(screen.getByText(/Сеть недоступна/)).toBeInTheDocument())
        expect(onDelete).not.toHaveBeenCalled()
    })

    it('удаление правила по-прежнему работает независимо от деактивации', async () => {
        const onDelete = vi.fn()
        const user = userEvent.setup()
        renderHeader({ draft: makeDraft({ ruleId: undefined }), onDelete })

        await user.click(screen.getByRole('button', { name: 'Удалить правило' }))

        expect(onDelete).toHaveBeenCalledTimes(1)
    })
})
