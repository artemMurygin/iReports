import { useState } from 'react'

/**
 * Реализует часть change delete-task-frontend (delete-task-frontend): confirm-хук диалога удаления
 * задачи — по образцу `useDeleteRuleTask`
 * (`features/SalaryRuleForm/model/useDeleteRuleTask.ts`); `confirm` принимает произвольный
 * async-раннер (например, `useDeleteTask`'ный `mutateAsync`) — хук ничего не знает про конкретное
 * API удаления.
 */
export function useDeleteTaskDialog() {
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
