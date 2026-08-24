import { useEffect } from 'react'
import { format } from 'date-fns'
import { Loader2, Trash2, TriangleAlert } from 'lucide-react'
import type { BalanceTransaction } from 'ireports-contracts'

import { formatSignedCurrency } from '@/shared/lib/format.ts'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { transactionTypeLabel } from '../model/transactionLabels.ts'
import { useDeleteTransaction } from '../model/useEmployeeBalanceMutations.ts'

export type DeleteTransactionDialogProps = {
    /** `null` — диалог закрыт (нет цели удаления). */
    transaction: BalanceTransaction | null
    onOpenChange: (open: boolean) => void
}

/**
 * Confirm-модалка «Удалить движение» (правка Фазы 8b): БЕЗ поля комментария — DELETE
 * `.../transactions/:id` не принимает тело — и без слова «сторно»: движение исчезает из
 * ленты безвозвратно, не заменяется обратной записью. Только для ручных движений без
 * документа ERP (кнопка видна в ленте, только когда `isDeletable(transaction)` — сама
 * проверка снаружи, в `TransactionsLedger`).
 */
export function DeleteTransactionDialog({ transaction, onOpenChange }: DeleteTransactionDialogProps) {
    const deleteMutation = useDeleteTransaction()
    const { reset } = deleteMutation
    const open = transaction !== null

    useEffect(() => {
        if (open) reset()
    }, [open, reset])

    const isDeleting = deleteMutation.isPending

    function handleOpenChange(next: boolean) {
        if (!next && isDeleting) return
        onOpenChange(next)
    }

    function submit() {
        if (transaction === null) return
        deleteMutation.mutate(transaction.id, { onSuccess: () => onOpenChange(false) })
    }

    if (transaction === null) return null

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title="Удалить движение"
            subtitle={`${transactionTypeLabel[transaction.type]} · ${formatSignedCurrency(transaction.amount)} · ${format(new Date(transaction.occurredAt), 'dd.MM.yyyy')}`}
            footer={
                <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isDeleting}>
                        Отмена
                    </Button>
                    <Button type="button" variant="danger" onClick={submit} disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                        {isDeleting ? 'Удаляем…' : 'Удалить'}
                    </Button>
                </div>
            }
        >
            <div className="flex items-start gap-2.5 rounded-xl bg-danger-soft px-4 py-3.5 font-ui text-[13px] text-danger">
                <TriangleAlert className="mt-0.5 size-[18px] shrink-0" />
                <div>
                    <p className="font-semibold">Удаление необратимо</p>
                    <p className="mt-0.5">
                        Движение исчезнет из ленты, а остаток пересчитается. Отменить это действие будет нельзя.
                    </p>
                </div>
            </div>

            {deleteMutation.error !== null && (
                <p className="mt-3 font-ui text-[13px] text-danger">Не удалось удалить движение, попробуйте ещё раз</p>
            )}
        </Modal>
    )
}
