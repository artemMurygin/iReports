import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useCreateTaskCompletionRuleWizard } from './useCreateTaskCompletionRuleWizard.ts'

/**
 * replace-bitrix-task-integration, раздел 14 tasks.md (14.1) — оркестрация мастера: `step`
 * начинается на "task" (Шаг 1 — создать задачу) и переходит на "rule" (Шаг 2 — форма правила)
 * ТОЛЬКО после того, как Шаг 1 успешно создал задачу и сообщил её `taskId`
 * (`goToRuleStep`) — переход на Шаг 2 невозможен раньше. Хук не содержит собственной бизнес-логики
 * создания ни задачи, ни правила — только эти два поля состояния и переход между ними.
 */
describe('useCreateTaskCompletionRuleWizard', () => {
    it('starts on the task step with no created task yet', () => {
        const { result } = renderHook(() => useCreateTaskCompletionRuleWizard())

        expect(result.current.step).toBe('task')
        expect(result.current.createdTaskId).toBeNull()
    })

    it('moves to the rule step only once Step 1 reports a created taskId', () => {
        const { result } = renderHook(() => useCreateTaskCompletionRuleWizard())

        act(() => result.current.goToRuleStep('task-42'))

        expect(result.current.step).toBe('rule')
        expect(result.current.createdTaskId).toBe('task-42')
    })

    it('reset() returns the wizard back to the task step', () => {
        const { result } = renderHook(() => useCreateTaskCompletionRuleWizard())
        act(() => result.current.goToRuleStep('task-42'))

        act(() => result.current.reset())

        expect(result.current.step).toBe('task')
        expect(result.current.createdTaskId).toBeNull()
    })
})
