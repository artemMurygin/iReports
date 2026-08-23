import { CircleCheck, Loader2, Wallet } from 'lucide-react'
import type { SalaryAccrual } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { pluralizeDocuments } from '../model/accrualView.ts'

export type AccrueSelectedDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Выбранные документы (уже без `PAID` — Selection Bar не даёт их выбрать). */
    items: SalaryAccrual[]
    isSubmitting: boolean
    onConfirm: () => void
}

/**
 * Confirm перед «Начислить выбранным» (Selection Bar, P1.2) — перечень ФИО + сумм и общая
 * сумма, кнопка «Начислить N документов». Построен на `Modal` тем же приёмом, что
 * `ClosePeriodDialog` (features/AccountingPeriod), но без отдельного `model/`-подмодуля —
 * состояние здесь исчерпывается `isSubmitting` (нет собственной загрузки превью, список уже
 * есть на странице), поэтому один файл вместо `ui/AccrueSelectedDialog/{model,ui}`.
 */
function AccrueSelectedDialog({ open, onOpenChange, items, isSubmitting, onConfirm }: AccrueSelectedDialogProps) {
    const totalAmount = items.reduce((sum, item) => sum + item.total, 0)

    function handleOpenChange(next: boolean) {
        if (!next && isSubmitting) return
        onOpenChange(next)
    }

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title={`Начислить ${items.length} ${pluralizeDocuments(items.length)}`}
            subtitle="Каждый документ будет проведён построчно — так же, как «Начислить всё» в карточке"
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
                        disabled={isSubmitting || items.length === 0}
                        className="max-sm:flex-1"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Wallet />}
                        {isSubmitting ? 'Начисляем…' : `Начислить ${items.length} ${pluralizeDocuments(items.length)}`}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-3">
                <ul className="divide-y divide-hairline rounded-xl border border-hairline">
                    {items.map((item) => (
                        <li key={item.id} className="flex items-center gap-2.5 px-4 py-3">
                            <CircleCheck className="size-4 shrink-0 text-ok-ink" />
                            <span className="min-w-0 flex-1 truncate font-ui text-[13px] font-semibold text-ink">
                                {item.employeeName}
                            </span>
                            <span className="shrink-0 font-ui text-[13px] font-semibold text-ink tabular-nums">
                                {formatCurrency(item.total)}
                            </span>
                        </li>
                    ))}
                </ul>
                <div className="flex items-center justify-between rounded-xl bg-brand-soft px-4 py-3">
                    <span className="font-ui text-[13px] font-medium text-ok-ink">Итого</span>
                    <span className="font-ui text-sm font-bold text-ok-ink tabular-nums">
                        {formatCurrency(totalAmount)}
                    </span>
                </div>
            </div>
        </Modal>
    )
}

export { AccrueSelectedDialog }
