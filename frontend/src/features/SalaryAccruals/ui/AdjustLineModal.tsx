import { useEffect, useState, type ReactNode } from 'react'
import { isAxiosError } from 'axios'
import { Check, Loader2, TriangleAlert } from 'lucide-react'
import type { SalaryAccrualLine, SalesDirection } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { Textarea } from '@/shared/ui-kit/atoms/Textarea'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { useAdjustLine } from '../model/useAccrualMutations.ts'

export type AdjustLineModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    line: SalaryAccrualLine
    direction: SalesDirection
    accrualId: string
}

/** Текст ошибки сохранения — бэкенд отдаёт 400 (пустой комментарий) и 409 (строка уже не
 * `DRAFT`) с человекочитаемым `message` в теле; свой текст — только страховка на случай
 * пустого/сетевого ответа (тот же приём, что `readBody` в `closePeriodErrors.ts`, но без
 * отдельного файла-классификатора — здесь всего два кода ошибки). */
function readAdjustLineErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const body = error.response?.data as { message?: unknown } | undefined
        if (typeof body?.message === 'string' && body.message.trim() !== '') return body.message
        if (error.response?.status === 400) return 'Комментарий обязателен для корректировки строки'
        if (error.response?.status === 409) return 'Строку нельзя скорректировать — она уже не в «Черновике»'
    }
    return 'Не удалось сохранить корректировку, попробуйте ещё раз'
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2">
            <span className="font-ui text-xs font-semibold text-ink">{label}</span>
            {children}
        </div>
    )
}

/**
 * «Корректировка строки» (P1.3, Pencil `w1BVLM`) — в макете drawer, здесь общий `Modal`
 * (по инструкции задачи и образцу `ReopenPeriodDialog`/`IdentityFormModal`, в ките нет
 * отдельного компонента bottom-sheet/drawer). Исходная сумма — read-only, комментарий
 * обязателен; ошибка сохранения показывается inline в теле модалки (не toast), как
 * `ClosePeriodDialog`/`ReopenPeriodDialog`.
 */
function AdjustLineModal({ open, onOpenChange, line, direction, accrualId }: AdjustLineModalProps) {
    const adjustMutation = useAdjustLine(direction, accrualId)
    const { reset } = adjustMutation

    const [amount, setAmount] = useState(() => String(line.amount))
    const [comment, setComment] = useState(line.adjustmentComment ?? '')
    const [validationError, setValidationError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setAmount(String(line.amount))
        setComment(line.adjustmentComment ?? '')
        setValidationError(null)
        reset()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, line.id])

    const isSaving = adjustMutation.isPending
    const serverError = adjustMutation.error !== null ? readAdjustLineErrorMessage(adjustMutation.error) : null
    const errorText = validationError ?? serverError

    function handleOpenChange(next: boolean) {
        if (!next && isSaving) return
        onOpenChange(next)
    }

    function submit() {
        const parsedAmount = Number(amount)
        if (amount.trim() === '' || !Number.isFinite(parsedAmount)) {
            setValidationError('Введите корректную сумму')
            return
        }
        if (comment.trim() === '') {
            setValidationError('Комментарий обязателен')
            return
        }
        setValidationError(null)
        adjustMutation.mutate(
            { lineId: line.id, amount: Math.round(parsedAmount), comment: comment.trim() },
            { onSuccess: () => onOpenChange(false) },
        )
    }

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title="Корректировка строки"
            subtitle={line.name}
            footer={
                <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSaving}>
                        Отмена
                    </Button>
                    <Button type="button" onClick={submit} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin" /> : <Check />}
                        Сохранить
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <Field label="Исходная сумма">
                    <div className="flex h-9 w-full items-center rounded-[8px] border border-hairline bg-canvas px-3 font-ui text-[13px] font-medium text-ink-muted tabular-nums">
                        {formatCurrency(line.originalAmount)}
                    </div>
                </Field>

                <Field label="Новая сумма">
                    <Input
                        type="number"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        aria-label="Новая сумма"
                        disabled={isSaving}
                    />
                </Field>

                <Field label="Комментарий">
                    <Textarea
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="Например, доплата за срочность"
                        aria-label="Комментарий"
                        disabled={isSaving}
                    />
                </Field>

                {errorText !== null && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-danger-soft px-4 py-3.5 font-ui text-[13px] text-danger">
                        <TriangleAlert className="mt-0.5 size-[18px] shrink-0" />
                        <span>{errorText}</span>
                    </div>
                )}
            </div>
        </Modal>
    )
}

export { AdjustLineModal }
