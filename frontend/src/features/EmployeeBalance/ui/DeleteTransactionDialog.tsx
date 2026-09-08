import { useEffect } from 'react'
import { isAxiosError } from 'axios'
import { format } from 'date-fns'
import { CircleX, Loader2, RotateCw, Trash2, TriangleAlert } from 'lucide-react'
import type { BalanceTransaction } from 'ireports-contracts'

import { formatSignedCurrency } from '@/shared/lib/format.ts'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { ERP_SYSTEM_LABEL, transactionTypeLabel } from '../model/transactionLabels.ts'
import { useDeleteTransaction } from '../model/useEmployeeBalanceMutations.ts'

export type DeleteTransactionDialogProps = {
    /** `null` — диалог закрыт (нет цели удаления). */
    transaction: BalanceTransaction | null
    onOpenChange: (open: boolean) => void
}

/** 400/409/5xx с человекочитаемым `message` в теле — тот же приём, что
 * `readPayoutErrorMessage` (`model/payoutHelpers.ts`, этой же фичи): при ошибке ERP-удаления
 * бэкенд отдаёт конкретный текст («RemOnline не позволил удалить документ: …»). */
function readDeleteErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const body = error.response?.data as { message?: unknown } | undefined
        if (typeof body?.message === 'string' && body.message.trim() !== '') return body.message
    }
    return 'Не удалось удалить движение, попробуйте ещё раз'
}

/**
 * Confirm-модалка «Удалить движение» (правка Фазы 8b, дополнена Фазой 15 — ERP-документ): БЕЗ
 * поля комментария — DELETE `.../transactions/:id` не принимает тело — и без слова «сторно»:
 * движение исчезает из ленты безвозвратно, не заменяется обратной записью. Для ручных движений
 * (кнопка видна в ленте, только когда `isDeletable(transaction)` — сама проверка снаружи, в
 * `TransactionsLedger`/`TransactionsCardList`; `PAYOUT` сюда не попадает — у него свой
 * `DeletePayoutDialog`, этой же фичи).
 *
 * Когда у движения есть документ ERP (`transaction.erp !== null`), текст предупреждает, что
 * сначала удаляется именно он — и при отказе ERP («RemOnline не позволил удалить документ: …»)
 * ничего не меняется на балансе: кнопка переключается в «Повторить», ошибка читается из тела
 * ответа (тот же приём, что `PayoutDrawer`/`DeletePayoutDialog`), а не статичный текст.
 */
export function DeleteTransactionDialog({ transaction, onOpenChange }: DeleteTransactionDialogProps) {
    const deleteMutation = useDeleteTransaction()
    const { reset } = deleteMutation
    const open = transaction !== null

    useEffect(() => {
        if (open) reset()
    }, [open, reset])

    const isDeleting = deleteMutation.isPending
    const hasErpDocument = transaction?.erp !== null && transaction?.erp !== undefined

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
                        {isDeleting ? (
                            <Loader2 className="animate-spin" />
                        ) : deleteMutation.error !== null ? (
                            <RotateCw />
                        ) : (
                            <Trash2 />
                        )}
                        {isDeleting ? 'Удаляем…' : deleteMutation.error !== null ? 'Повторить' : 'Удалить'}
                    </Button>
                </div>
            }
        >
            <div className="flex items-start gap-2.5 rounded-xl bg-danger-soft px-4 py-3.5 font-ui text-[13px] text-danger">
                <TriangleAlert className="mt-0.5 size-[18px] shrink-0" />
                <div>
                    <p className="font-semibold">Удаление необратимо</p>
                    <p className="mt-0.5">
                        {hasErpDocument && transaction.erp !== null
                            ? `Будет удалён документ ${ERP_SYSTEM_LABEL[transaction.erp.system]} · ${transaction.erp.externalId}, движение исчезнет из ленты, остаток пересчитается. Отменить это действие будет нельзя.`
                            : 'Движение исчезнет из ленты, а остаток пересчитается. Отменить это действие будет нельзя.'}
                    </p>
                </div>
            </div>

            {deleteMutation.error !== null && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-danger-soft px-4 py-3.5 font-ui text-[13px] text-danger">
                    <CircleX className="mt-0.5 size-[18px] shrink-0" />
                    <span>{readDeleteErrorMessage(deleteMutation.error)}{hasErpDocument ? ' Ничего не изменено.' : ''}</span>
                </div>
            )}
        </Modal>
    )
}
