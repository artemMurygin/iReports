import { useState } from 'react'

/**
 * Confirm-диалог + запуск одного async-действия для «Деактивировать правило» на карточке правила
 * (`RuleFormCardHeader`) — тот же generic паттерн confirm/pending/error, что и `useDeleteRuleTask.ts`
 * (open/close/confirm вокруг переданного колбэка), но отдельный хук, а не переиспользование того же:
 * деактивация — soft-delete уже сохранённого правила через `POST .../salary-rules/:ruleId/deactivate`
 * (см. `contracts/commands/salary-rule.ts`'s `isActive` comment), доступна для правила ЛЮБОГО типа
 * (не только `TaskCompletion`, как каскадное удаление в `useDeleteRuleTask.ts`) и никак не
 * затрагивает связанную с правилом задачу.
 *
 * Хук нарочно ничего не знает о правилах/API — `confirm(action)` просто запускает переданный
 * async-колбэк и управляет `isPending`/`error`/закрытием диалога вокруг него.
 */
export function useDeactivateRule() {
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
            setError(err instanceof Error ? err.message : 'Не удалось деактивировать')
        } finally {
            setIsPending(false)
        }
    }

    return { isOpen, open, close, confirm, isPending, error }
}
