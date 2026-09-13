import { Ban, CircleX, Loader2, RotateCw } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

export type DeactivateRuleDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    ruleName: string
    onConfirm: () => void
    isPending: boolean
    error: string | null
}

/**
 * Confirm «Деактивировать правило «N»?» на карточке правила (`RuleFormCardHeader`) — по образцу
 * `DeleteRuleTaskDialog.tsx`/`DeleteMotivationSchemaDialog.tsx`: `Modal` из `shared/ui-kit`, кнопка
 * с состояниями idle/pending/error, закрытие заблокировано во время `isPending`. В отличие от тех
 * двух — не `danger`-кнопка и без упоминания безвозвратности: деактивация обратима (отдельный
 * эндпоинт `.../activate`) и никак не трогает связанную с правилом задачу `TaskCompletion`.
 */
export function DeactivateRuleDialog({
    open,
    onOpenChange,
    ruleName,
    onConfirm,
    isPending,
    error,
}: DeactivateRuleDialogProps) {
    function handleOpenChange(next: boolean) {
        if (!next && isPending) return
        onOpenChange(next)
    }

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title={`Деактивировать правило «${ruleName}»?`}
            footer={
                <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
                        Отмена
                    </Button>
                    <Button type="button" variant="secondary" onClick={onConfirm} disabled={isPending}>
                        {isPending ? <Loader2 className="animate-spin" /> : error !== null ? <RotateCw /> : <Ban />}
                        {isPending ? 'Деактивируем…' : error !== null ? 'Повторить' : 'Деактивировать'}
                    </Button>
                </div>
            }
        >
            <p className="font-ui text-[13px] text-ink-muted">
                Правило будет деактивировано и перестанет участвовать в расчётах.
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
