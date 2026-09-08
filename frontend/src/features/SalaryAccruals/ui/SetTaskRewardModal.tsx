import { useEffect, useState, type ReactNode } from 'react'
import { isAxiosError } from 'axios'
import { Check, Loader2, TriangleAlert } from 'lucide-react'
import type { SalaryAccrualLine, SalesDirection } from 'ireports-contracts'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { Textarea } from '@/shared/ui-kit/atoms/Textarea'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { useSetTaskCompletionLineReward } from '../model/useAccrualMutations.ts'

export type SetTaskRewardModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    line: SalaryAccrualLine
    direction: SalesDirection
    accrualId: string
}

/** Текст ошибки сохранения — тот же приём, что `readAdjustLineErrorMessage` в
 * `AdjustLineModal.tsx`: бэкенд отдаёт 400 (пустой комментарий) и 409 (строка уже не ждёт
 * ручного ввода — не `requiresManualInput`, либо уже не `DRAFT`) с человекочитаемым
 * `message`, свой текст — только страховка на случай пустого/сетевого ответа. */
function readSetTaskRewardErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const body = error.response?.data as { message?: unknown } | undefined
        if (typeof body?.message === 'string' && body.message.trim() !== '') return body.message
        if (error.response?.status === 400) return 'Комментарий обязателен для указания суммы'
        if (error.response?.status === 409) return 'Сумму по строке уже нельзя указать — она изменилась'
    }
    return 'Не удалось сохранить сумму, попробуйте ещё раз'
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
 * «Указать сумму» — ручной ввод суммы+комментария строки правила «за выполнение задачи»
 * (add-task-based-salary-rule, design.md Decision 5, tasks.md раздел 24). `ui-design.md`
 * явно фиксирует отсутствие Pencil-макета для `SalaryAccrualDocument` — модалка собрана из
 * тех же примитивов и по тому же приёму, что уже применённый в проекте для экранов без
 * фрейма (`AdjustLineModal.tsx`, `pages/Login`/`pages/OAuthCallback`), явное осознанное
 * отклонение, а не пропуск.
 *
 * В отличие от `AdjustLineModal` — нет поля «Исходная сумма» (`originalAmount` для этого
 * типа строк всегда 0, показывать зачёркнутый ноль читателю не имеет смысла) и нет
 * `adjustedBy` в теле запроса (первичный ввод, не корректировка — см.
 * `setTaskCompletionLineRewardRequestSchema`).
 */
function SetTaskRewardModal({ open, onOpenChange, line, direction, accrualId }: SetTaskRewardModalProps) {
    const rewardMutation = useSetTaskCompletionLineReward(direction, accrualId)
    const { reset } = rewardMutation

    const [amount, setAmount] = useState(() => (line.amount ? String(line.amount) : ''))
    const [comment, setComment] = useState(line.comment ?? '')
    const [validationError, setValidationError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setAmount(line.amount ? String(line.amount) : '')
        setComment(line.comment ?? '')
        setValidationError(null)
        reset()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, line.id])

    const isSaving = rewardMutation.isPending
    const serverError = rewardMutation.error !== null ? readSetTaskRewardErrorMessage(rewardMutation.error) : null
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
        rewardMutation.mutate(
            { lineId: line.id, amount: Math.round(parsedAmount), comment: comment.trim() },
            { onSuccess: () => onOpenChange(false) },
        )
    }

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title="Указать сумму начисления"
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
                <Field label="Сумма">
                    <Input
                        type="number"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        aria-label="Сумма"
                        disabled={isSaving}
                    />
                </Field>

                <Field label="Комментарий">
                    <Textarea
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="Например, что именно сделано и почему такая сумма"
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

export { SetTaskRewardModal }
