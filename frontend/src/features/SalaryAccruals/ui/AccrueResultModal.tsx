import { CircleCheck, Loader2, RotateCcw, TriangleAlert } from 'lucide-react'

import { formatCurrency } from '@/shared/lib/format.ts'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { pluralizeDocuments } from '../model/accrualView.ts'
import type { AccrueBatchResult } from '../model/accrueBatch.ts'

export type AccrueResultModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** `null` только пока не выполнена ни одна операция — родитель монтирует диалог
     * закрытым в этом случае, содержимое ниже отрисовывает пустой фрагмент. */
    result: AccrueBatchResult | null
    isRetrying: boolean
    /** Повторяет `accrueDocument` только для `accrualId` из `result.failures` (см.
     * `useSalaryAccrualsPage`) — скрыта, пока `result.failures` пуст. */
    onRetryFailed: () => void
}

/**
 * Результат «Начислить выбранным» / «Начислить все документы месяца» (P2.1): «Начислено X
 * из Y документов на Z ₽», перечень ошибок (ФИО, правило, текст) при наличии, «Повторить
 * для неудачных» + «Закрыть». Один и тот же компонент обслуживает оба источника — оба
 * сводятся к `AccrueBatchResult` (`accrueBatch.ts`) до того, как дойти сюда. Закрытие —
 * только через `onOpenChange(false)` (оверлей/Escape/«Закрыть»), тот же единственный
 * канал, что у `ClosePeriodDialog`.
 */
function AccrueResultModal({ open, onOpenChange, result, isRetrying, onRetryFailed }: AccrueResultModalProps) {
    const hasFailures = result !== null && result.failures.length > 0

    function handleOpenChange(next: boolean) {
        if (!next && isRetrying) return
        onOpenChange(next)
    }

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title="Результат начисления"
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
                            {isRetrying ? 'Повторяем…' : 'Повторить для неудачных'}
                        </Button>
                    )}
                    <Button
                        type="button"
                        onClick={() => handleOpenChange(false)}
                        disabled={isRetrying}
                        className="max-sm:flex-1"
                    >
                        Закрыть
                    </Button>
                </div>
            }
        >
            {result !== null && (
                <div className="flex flex-col gap-4">
                    <div
                        className={
                            'flex items-center gap-3 rounded-xl px-4 py-3.5 ' +
                            (hasFailures ? 'bg-warn-soft' : 'bg-brand-soft')
                        }
                    >
                        {hasFailures ? (
                            <TriangleAlert className="size-[18px] shrink-0 text-warn-ink" />
                        ) : (
                            <CircleCheck className="size-[18px] shrink-0 text-ok-ink" />
                        )}
                        <p
                            className={
                                'font-ui text-[13px] font-medium ' + (hasFailures ? 'text-warn-ink' : 'text-ok-ink')
                            }
                        >
                            Начислено {result.accruedCount} из {result.totalCount}{' '}
                            {pluralizeDocuments(result.totalCount)} на {formatCurrency(result.accruedAmount)}
                        </p>
                    </div>

                    {hasFailures && (
                        <div className="flex flex-col gap-2.5">
                            <h3 className="font-ui text-sm font-bold text-ink">
                                Не удалось начислить · {result.failures.length}
                            </h3>
                            <ul className="divide-y divide-hairline rounded-xl border border-hairline">
                                {result.failures.map((failure, index) => (
                                    <li key={`${failure.accrualId}-${index}`} className="flex flex-col gap-1 px-4 py-3">
                                        <span className="font-ui text-[13px] font-semibold text-ink">
                                            {failure.employeeName}
                                            <span className="font-normal text-ink-muted"> · {failure.ruleName}</span>
                                        </span>
                                        <span className="font-ui text-xs text-danger">{failure.message}</span>
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

export { AccrueResultModal }
