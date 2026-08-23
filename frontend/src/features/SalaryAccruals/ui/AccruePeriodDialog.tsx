import { CircleCheck, Loader2, RefreshCw, TriangleAlert, Wallet } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { pluralizeDocuments } from '../model/accrualView.ts'

export type AccruePeriodDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** «июль 2026 · Сервис» — подзаголовок диалога. */
    periodDirectionLabel: string
    /** Число не-`PAID` документов в текущем списке (см. `useSalaryAccrualsPage`). */
    count: number
    isSubmitting: boolean
    /** Ошибка самого запроса `accruePeriod` (сеть/5xx) — в отличие от «Начислить
     * выбранным», это один запрос без частичного успеха, поэтому неудача остаётся в
     * диалоге (с «Повторить»), а не уходит в модалку результата. */
    errorMessage: string | null
    onConfirm: () => void
}

/**
 * Confirm перед «Начислить все документы месяца» (Page Header, P1.2) — простой текст
 * «Будет начислено N документов», кнопка подтверждения. Тот же приём файловой структуры,
 * что `AccrueSelectedDialog` (один файл, без `model/`-подмодуля).
 */
function AccruePeriodDialog({
    open,
    onOpenChange,
    periodDirectionLabel,
    count,
    isSubmitting,
    errorMessage,
    onConfirm,
}: AccruePeriodDialogProps) {
    function handleOpenChange(next: boolean) {
        if (!next && isSubmitting) return
        onOpenChange(next)
    }

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title="Начислить все документы месяца"
            subtitle={periodDirectionLabel}
            footer={
                <div className="flex flex-wrap items-center justify-end gap-2.5 max-sm:w-full">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Отмена
                    </Button>
                    <Button
                        type="button"
                        onClick={onConfirm}
                        disabled={isSubmitting || count === 0}
                        className="max-sm:flex-1"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Wallet />}
                        {isSubmitting ? 'Начисляем…' : `Начислить ${count} ${pluralizeDocuments(count)}`}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-xl bg-brand-soft px-4 py-3.5">
                    <CircleCheck className="size-[18px] shrink-0 text-ok-ink" />
                    <p className="font-ui text-[13px] font-medium text-ok-ink">
                        Будет начислено {count} {pluralizeDocuments(count)}
                    </p>
                </div>

                {errorMessage !== null && (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-danger-soft px-4 py-3.5 sm:flex-nowrap">
                        <TriangleAlert className="size-[18px] shrink-0 self-start pt-0.5 text-danger" />
                        <div className="min-w-0 flex-1 basis-52 font-ui text-[13px] text-danger">
                            <p className="font-semibold">Не удалось начислить документы месяца</p>
                            <p className="mt-0.5">{errorMessage}</p>
                        </div>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={onConfirm}
                            className="shrink-0 max-sm:w-full"
                        >
                            <RefreshCw />
                            Повторить
                        </Button>
                    </div>
                )}
            </div>
        </Modal>
    )
}

export { AccruePeriodDialog }
