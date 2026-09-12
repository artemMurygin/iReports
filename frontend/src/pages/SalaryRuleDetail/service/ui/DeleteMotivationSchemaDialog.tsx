import { CircleX, Loader2, RotateCw, Trash2 } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

export type DeleteMotivationSchemaDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    schemaName: string
    onConfirm: () => void
    isPending: boolean
    error: string | null
}

/**
 * Implements FR1, FR4 of delete-motivation-schema. Confirm «Удалить схему «N»?» — по образцу
 * `features/EmployeeBalance/ui/DeletePayoutDialog.tsx`/`pages/EmployeeIdentity/ui/DeleteIdentityModal.tsx`
 * (см. ui-design.md): `Modal` из `shared/ui-kit`, danger-кнопка с состояниями idle/pending/error,
 * закрытие модалки заблокировано во время `isPending`.
 */
export function DeleteMotivationSchemaDialog({
    open,
    onOpenChange,
    schemaName,
    onConfirm,
    isPending,
    error,
}: DeleteMotivationSchemaDialogProps) {
    function handleOpenChange(next: boolean) {
        if (!next && isPending) return
        onOpenChange(next)
    }

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title={`Удалить схему «${schemaName}»?`}
            footer={
                <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
                        Отмена
                    </Button>
                    <Button type="button" variant="danger" onClick={onConfirm} disabled={isPending}>
                        {isPending ? <Loader2 className="animate-spin" /> : error !== null ? <RotateCw /> : <Trash2 />}
                        {isPending ? 'Удаляем…' : error !== null ? 'Повторить' : 'Удалить'}
                    </Button>
                </div>
            }
        >
            <p className="font-ui text-[13px] text-ink-muted">
                Все правила схемы будут удалены безвозвратно. Действие нельзя отменить.
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
