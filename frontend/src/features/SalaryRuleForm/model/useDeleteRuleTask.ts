import { useState } from 'react'

/**
 * add-task-rule-task-lifecycle — «Удалить задачу» на карточке правила `TaskCompletion`
 * (`TaskCompletionRuleFields`): confirm-диалог (`DeleteRuleTaskDialog`) + запуск ОДНОГО из двух
 * действий, которые решает сам `TaskCompletionRuleFields` (не этот хук — он не знает про
 * `draft.ruleId`/API):
 * - задача ещё не привязана к сохранённому правилу (`draft.ruleId === undefined`) — просто
 *   `DELETE /v1/tasks/:id` + очистка `draft.taskId`;
 * - задача принадлежит уже сохранённому правилу — каскадное удаление правила+задачи
 *   (`onDeleteRule`, немедленно на бэкенде — правило не может существовать без задачи).
 *
 * Хук нарочно ничего не знает о задачах/правилах — `confirm(action)` просто запускает переданный
 * async-колбэк и управляет `isPending`/`error`/закрытием диалога вокруг него.
 */
export function useDeleteRuleTask() {
    const [isOpen, setIsOpen] = useState(false)
    const [isPending, setIsPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    function open() {
        setError(null)
        setIsOpen(true)
    }

    function close() {
        if (isPending) return
        setIsOpen(false)
        setError(null)
    }

    async function confirm(action: () => Promise<void>) {
        setIsPending(true)
        setError(null)
        try {
            await action()
            setIsOpen(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось удалить')
        } finally {
            setIsPending(false)
        }
    }

    return { isOpen, open, close, confirm, isPending, error }
}
