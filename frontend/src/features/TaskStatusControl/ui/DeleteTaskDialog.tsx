import { CircleX, Loader2, RotateCw, Trash2 } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

export type DeleteTaskDialogProps = {
    isOpen: boolean
    taskTitle: string
    isPending: boolean
    error: string | null
    onConfirm: () => void
    onCancel: () => void
}

/**
 * Implements FR-3 of delete-task-frontend: confirm-диалог удаления произвольной задачи из карточки
 * (`TaskStatusCard`), по образцу `DeleteRuleTaskDialog` — `Modal` из `shared/ui-kit`, danger-кнопка
 * idle/pending/error, закрытие заблокировано во время `isPending`.
 */
export function DeleteTaskDialog({ isOpen, taskTitle, isPending, error, onConfirm, onCancel }: DeleteTaskDialogProps) {
    function handleOpenChange(next: boolean) {
        if (!next) {
            if (isPending) return
            onCancel()
        }
    }

    return (
        <Modal
            open={isOpen}
            onOpenChange={handleOpenChange}
            title={`Удалить задачу «${taskTitle}»?`}
            footer={
                <div className="flex items-center justify-between gap-2">
                    <Button type="button" variant="danger" onClick={onConfirm} disabled={isPending}>
                        {isPending ? <Loader2 className="animate-spin" /> : error !== null ? <RotateCw /> : <Trash2 />}
                        {isPending ? 'Удаляем…' : error !== null ? 'Повторить' : 'Удалить'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
                        Отмена
                    </Button>
                </div>
            }
        >
            <p className="font-ui text-[13px] text-ink-muted">Задача будет удалена безвозвратно.</p>

            {error !== null && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-danger-soft px-4 py-3.5 font-ui text-[13px] text-danger">
                    <CircleX className="mt-0.5 size-[18px] shrink-0" />
                    <span>{error}</span>
                </div>
            )}
        </Modal>
    )
}
