import { useEffect } from 'react'
import { isAxiosError } from 'axios'
import { format } from 'date-fns'
import { CircleX, Loader2, RotateCw, Trash2 } from 'lucide-react'
import type { BalanceTransaction } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { ERP_SYSTEM_LABEL } from '../model/transactionLabels.ts'
import { useDeletePayout } from '../model/useEmployeeBalanceMutations.ts'

export type DeletePayoutDialogProps = {
    /** `null` — диалог закрыт (нет цели удаления). Должна быть транзакция типа `PAYOUT`. */
    transaction: BalanceTransaction | null
    onOpenChange: (open: boolean) => void
}

function readDeleteErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const body = error.response?.data as { message?: unknown } | undefined
        if (typeof body?.message === 'string' && body.message.trim() !== '') return body.message
    }
    return 'Не удалось удалить документ, попробуйте ещё раз'
}

/**
 * Confirm «Удалить выплату N ₽ от ДД.ММ.ГГГГ?» (Фаза 15 docs/payroll-closing-and-accrual,
 * P3.3; перенесено из бывшей `features/Payout/ui/DeletePayoutDialog.tsx` Фазой 6
 * docs/employee-settlements-page-redesign — точка входа «Выплатить» ушла в единый
 * drawer, но удаление уже существующего движения `PAYOUT` из ленты остаётся своим
 * путём, `DELETE .../payout/:id`, а не общим `DeleteTransactionDialog`, см.
 * `isPayoutTransaction`/`isDeletable` в `model/transactionLabels.ts`): будет удалён
 * расходный документ ERP и движение на балансе, документ начисления вернётся в
 * «Ожидает выплаты» (сервер применяет это ко всем затронутым документам направления
 * — `DELETE .../payout/:id` не хранит обратную связь «выплата → закрытые документы»).
 * При отказе ERP — inline-ошибка с текстом сервера и «Ничего не изменено», кнопка
 * переключается в «Повторить» (тот же приём, что `DeleteTransactionDialog`).
 */
export function DeletePayoutDialog({ transaction, onOpenChange }: DeletePayoutDialogProps) {
    const direction = transaction?.direction ?? 'service'
    const deleteMutation = useDeletePayout(direction)
    const { reset } = deleteMutation
    const open = transaction !== null

    useEffect(() => {
        if (open) reset()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, transaction?.id])

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

    const erpLine =
        transaction.erp !== null
            ? `Будет удалён расходный документ ${ERP_SYSTEM_LABEL[transaction.erp.system]} · ${transaction.erp.externalId} и движение на балансе. Документ начисления вернётся в «Ожидает выплаты».`
            : 'Будет удалено движение на балансе. Документ начисления вернётся в «Ожидает выплаты».'

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title={`Удалить выплату ${formatCurrency(Math.abs(transaction.amount))} от ${format(new Date(transaction.occurredAt), 'dd.MM.yyyy')}?`}
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
            <p className="font-ui text-[13px] text-ink-muted">{erpLine}</p>

            {deleteMutation.error !== null && (
                <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-danger-soft px-4 py-3.5 font-ui text-[13px] text-danger">
                    <CircleX className="mt-0.5 size-[18px] shrink-0" />
                    <span>{readDeleteErrorMessage(deleteMutation.error)} Ничего не изменено.</span>
                </div>
            )}
        </Modal>
    )
}
