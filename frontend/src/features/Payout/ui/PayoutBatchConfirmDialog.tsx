import { Banknote, CircleX, Loader2, TriangleAlert } from 'lucide-react'
import type { PayoutEmployeeRow } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Checkbox } from '@/shared/ui-kit/atoms/Checkbox'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { pluralizeEmployees } from '../model/payoutView.ts'

export type PayoutBatchConfirmDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Выбранные строки (уже без `PAID` — Selection Bar не даёт их выбрать). */
    items: PayoutEmployeeRow[]
    isSubmitting: boolean
    confirmNegativeBalance: boolean
    onConfirmNegativeBalanceChange: (value: boolean) => void
    errorMessage: string | null
    onConfirm: () => void
}

/**
 * Pencil `i9IXQ` — confirm перед «Выплатить выбранным» (Selection Bar, P3.1): перечень
 * ФИО + остатков, отдельная секция-предупреждение для сотрудников с нулевым/отрицательным
 * остатком с обязательным чекбоксом «Понимаю, выплатить им остаток/указанную сумму». Тот же
 * приём, что `AccrueSelectedDialog` (features/SalaryAccruals) — `Modal` без отдельного
 * `model/`-подмодуля, всё состояние — `confirmNegativeBalance`/`isSubmitting` пропсами.
 */
function PayoutBatchConfirmDialog({
    open,
    onOpenChange,
    items,
    isSubmitting,
    confirmNegativeBalance,
    onConfirmNegativeBalanceChange,
    errorMessage,
    onConfirm,
}: PayoutBatchConfirmDialogProps) {
    const totalAmount = items.reduce((sum, item) => sum + Math.max(item.balance, 0), 0)
    const negativeItems = items.filter((item) => item.balance <= 0)
    const canSubmit = items.length > 0 && (negativeItems.length === 0 || confirmNegativeBalance)

    function handleOpenChange(next: boolean) {
        if (!next && isSubmitting) return
        onOpenChange(next)
    }

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title={`Выплатить выбранным (${items.length})`}
            footer={
                <div className="flex flex-wrap items-center justify-end gap-2.5 max-sm:w-full">
                    <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                        Отмена
                    </Button>
                    <Button type="button" onClick={onConfirm} disabled={isSubmitting || !canSubmit} className="max-sm:flex-1">
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Banknote />}
                        {isSubmitting ? 'Выплачиваем…' : `Выплатить ${items.length} ${pluralizeEmployees(items.length)} · ${formatCurrency(totalAmount)}`}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-3">
                <ul className="max-h-[280px] divide-y divide-hairline overflow-y-auto rounded-xl border border-hairline">
                    {items.map((item) => (
                        <li key={item.employeeId} className="flex items-center gap-2.5 px-4 py-3">
                            <span className="min-w-0 flex-1 truncate font-ui text-[13px] font-semibold text-ink">
                                {item.name}
                            </span>
                            <span
                                className={
                                    'shrink-0 font-ui text-[13px] font-semibold tabular-nums ' +
                                    (item.balance <= 0 ? 'text-danger' : 'text-ink')
                                }
                            >
                                {item.balance <= 0
                                    ? `0 ₽ (остаток ${formatCurrency(item.balance)})`
                                    : formatCurrency(item.balance)}
                            </span>
                        </li>
                    ))}
                </ul>

                <div className="flex items-center justify-between rounded-xl bg-brand-soft px-4 py-3">
                    <span className="font-ui text-[13px] font-medium text-ok-ink">Итого</span>
                    <span className="font-ui text-sm font-bold text-ok-ink tabular-nums">{formatCurrency(totalAmount)}</span>
                </div>

                {negativeItems.length > 0 && (
                    <div className="flex flex-col gap-2.5 rounded-xl bg-warn-soft px-4 py-3.5">
                        <div className="flex items-start gap-2.5">
                            <TriangleAlert className="mt-0.5 size-[15px] shrink-0 text-warn-ink" />
                            <p className="font-ui text-[13px] font-semibold text-warn-ink">
                                {negativeItems.length} {pluralizeEmployees(negativeItems.length)} с нулевым или отрицательным
                                остатком — выплата уведёт баланс в минус
                            </p>
                        </div>
                        <label className="flex items-center gap-2.5">
                            <Checkbox
                                checked={confirmNegativeBalance}
                                onCheckedChange={onConfirmNegativeBalanceChange}
                                aria-label="Понимаю, выплатить им остаток/указанную сумму"
                            />
                            <span className="font-ui text-[13px] text-warn-ink">
                                Понимаю, выплатить им остаток/указанную сумму
                            </span>
                        </label>
                    </div>
                )}

                {errorMessage !== null && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-danger-soft px-4 py-3.5 font-ui text-[13px] text-danger">
                        <CircleX className="mt-0.5 size-[18px] shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}
            </div>
        </Modal>
    )
}

export { PayoutBatchConfirmDialog }
