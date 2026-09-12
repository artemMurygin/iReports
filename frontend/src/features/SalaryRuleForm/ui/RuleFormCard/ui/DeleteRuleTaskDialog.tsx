import { CircleX, Loader2, RotateCw, Trash2 } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

export type DeleteRuleTaskDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    taskTitle: string
    /** Удаляемая задача уже принадлежит СОХРАНЁННОМУ правилу (`draft.ruleId` есть) — правило не
     * может существовать без задачи, поэтому удаление каскадится на него немедленно. `false` —
     * задача ещё не привязана ни к какому сохранённому правилу (см. `TaskCompletionRuleFields.tsx`
     * WHY), удаляется только она, правило остаётся с пустым "Создать задачу". */
    alsoDeletesRule: boolean
    onConfirm: () => void
    isPending: boolean
    error: string | null
}

/**
 * add-task-rule-task-lifecycle — confirm «Удалить задачу «N»?» на карточке правила
 * `TaskCompletion` (см. `TaskCompletionRuleFields.tsx`), по образцу
 * `pages/SalaryRuleDetail/service/ui/DeleteMotivationSchemaDialog.tsx`: `Modal` из `shared/ui-kit`,
 * danger-кнопка idle/pending/error, закрытие заблокировано во время `isPending`.
 */
export function DeleteRuleTaskDialog({
    open,
    onOpenChange,
    taskTitle,
    alsoDeletesRule,
    onConfirm,
    isPending,
    error,
}: DeleteRuleTaskDialogProps) {
    function handleOpenChange(next: boolean) {
        if (!next && isPending) return
        onOpenChange(next)
    }

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title={
                alsoDeletesRule
                    ? `Удалить задачу «${taskTitle}» вместе с правилом?`
                    : `Удалить задачу «${taskTitle}»?`
            }
            footer={
                <div className="flex items-center justify-between gap-2">
                    <Button type="button" variant="danger" onClick={onConfirm} disabled={isPending}>
                        {isPending ? <Loader2 className="animate-spin" /> : error !== null ? <RotateCw /> : <Trash2 />}
                        {isPending ? 'Удаляем…' : error !== null ? 'Повторить' : 'Удалить'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
                        Отмена
                    </Button>
                </div>
            }
        >
            <p className="font-ui text-[13px] text-ink-muted">
                {alsoDeletesRule
                    ? 'Задача будет удалена безвозвратно вместе с зарплатным правилом — без задачи оно не может существовать.'
                    : 'Задача будет удалена безвозвратно. Правило при этом не удаляется — задачу можно будет создать заново.'}
            </p>

            {error !== null && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-danger-soft px-4 py-3.5 font-ui text-[13px] text-danger">
                    <CircleX className="mt-0.5 size-[18px] shrink-0" />
                    <span>{error} Ничего не изменено.</span>
                </div>
            )}
        </Modal>
    )
}
