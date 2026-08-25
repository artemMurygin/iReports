import { CircleCheck, Loader2, RotateCcw, TriangleAlert } from 'lucide-react'
import type { PayoutBatchResponse } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { pluralizeEmployees, retryableOutcomes } from '../model/payoutView.ts'

export type PayoutResultModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** `null`, пока не выполнена ни одна операция — родитель монтирует диалог закрытым. */
    result: PayoutBatchResponse | null
    isRetrying: boolean
    /** Повторяет запрос только для `employeeId` из `FAILED`/`NEEDS_CONFIRMATION` исходов, с
     * `confirmNegativeBalance: true` (пользователь уже увидел и принял предупреждение в
     * `PayoutBatchConfirmDialog` первым запросом). */
    onRetryFailed: () => void
}

/**
 * Pencil `NPdCW` — результат «Выплатить выбранным» (P3.1): «Выплачено X из Y на Z ₽», перечень
 * ошибок (ФИО + текст) при наличии, «Повторить для неудачных» + «Закрыть». Тот же приём, что
 * `AccrueResultModal` (features/SalaryAccruals).
 */
function PayoutResultModal({ open, onOpenChange, result, isRetrying, onRetryFailed }: PayoutResultModalProps) {
    const failures = result !== null ? retryableOutcomes(result.outcomes) : []
    const hasFailures = failures.length > 0

    function handleOpenChange(next: boolean) {
        if (!next && isRetrying) return
        onOpenChange(next)
    }

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title="Результат выплаты"
            footer={
                <div className="flex flex-wrap items-center justify-end gap-2.5 max-sm:w-full">
                    {hasFailures && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onRetryFailed}
                            disabled={isRetrying}
                            className="max-sm:flex-1"
                        >
                            {isRetrying ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                            {isRetrying ? 'Повторяем…' : 'Повторить неудачные'}
                        </Button>
                    )}
                    <Button type="button" onClick={() => handleOpenChange(false)} disabled={isRetrying} className="max-sm:flex-1">
                        Закрыть
                    </Button>
                </div>
            }
        >
            {result !== null && (
                <div className="flex flex-col gap-4">
                    <div
                        className={
                            'flex items-center gap-3 rounded-xl px-4 py-3.5 ' + (hasFailures ? 'bg-warn-soft' : 'bg-brand-soft')
                        }
                    >
                        {hasFailures ? (
                            <TriangleAlert className="size-[18px] shrink-0 text-warn-ink" />
                        ) : (
                            <CircleCheck className="size-[18px] shrink-0 text-ok-ink" />
                        )}
                        <p className={'font-ui text-[13px] font-medium ' + (hasFailures ? 'text-warn-ink' : 'text-ok-ink')}>
                            Выплачено {result.paidCount} из {result.outcomes.length}{' '}
                            {pluralizeEmployees(result.outcomes.length)} на {formatCurrency(result.totalPaidAmount)}
                        </p>
                    </div>

                    {hasFailures && (
                        <div className="flex flex-col gap-2.5">
                            <h3 className="font-ui text-sm font-bold text-ink">
                                Не выплачено · {failures.length}
                            </h3>
                            <ul className="divide-y divide-hairline rounded-xl border border-hairline">
                                {failures.map((failure) => (
                                    <li key={failure.employeeId} className="flex flex-col gap-1 px-4 py-3">
                                        <span className="font-ui text-[13px] font-semibold text-ink">
                                            {failure.employeeName}
                                        </span>
                                        <span className="font-ui text-xs text-danger">
                                            {failure.message ?? 'Требуется подтверждение отрицательного остатка'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    )
}

export { PayoutResultModal }
