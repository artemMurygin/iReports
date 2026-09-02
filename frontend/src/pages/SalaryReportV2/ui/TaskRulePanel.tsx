import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Check, Loader2, SquareArrowOutUpRight, TriangleAlert } from 'lucide-react'

import { formatCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Input } from '@/shared/ui-kit/atoms/Input'

import { TASK_RULE_STATUS_LABELS, useSetTaskRuleActualAmount, type SalaryReportRule } from '@/features/SalaryReportData'

export type TaskRulePanelProps = {
    rule: SalaryReportRule
    period: string
    isClosed: boolean
    className?: string
}

/** Текст ошибки сохранения фактической суммы — бэкенд отдаёт 400 (диапазон)/403 (задача не
 * "Закрыта")/409 (период закрыт) с человекочитаемым `message` (`ENDPOINTS.md`); свой текст — только
 * страховка на случай пустого/сетевого ответа (тот же приём, что `readAdjustLineErrorMessage` в
 * `features/SalaryAccruals/ui/AdjustLineModal.tsx`). */
function readActualAmountErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const body = error.response?.data as { message?: unknown } | undefined
        if (typeof body?.message === 'string' && body.message.trim() !== '') return body.message
    }
    return 'Не удалось сохранить сумму, попробуйте ещё раз'
}

/**
 * Блок правила-задачи внутри развёрнутого "Rail" правила (change salary-rule-bitrix-task):
 * ссылка на задачу Bitrix24 (spec.md "Ссылка на задачу Bitrix24", открывается в новой вкладке —
 * задача 10.1), статус задачи/пометка "задача недоступна" (spec.md "Обработка недоступной
 * задачи" — задача 10.3) и поле ввода фактической суммы по закрытой задаче (spec.md "Ручной ввод
 * фактической суммы по закрытой задаче" — задача 10.2). Рендерится только для правил
 * `type === 'TaskCompleted'`, отдельным блоком НАД `RuleSourcesRail` — не внутри `LedgerRuleRow`'s
 * кнопки-заголовка: `bitrixTaskUrl` — интерактивная ссылка, а весь заголовок строки уже сам
 * `<button>` разворота (вложенные интерактивные элементы недопустимы).
 *
 * Верхняя граница поля ввода — `rule.amount.prognose`: для задачи, чей текущий месяц совпадает с
 * отчётным периодом (обязательное условие, чтобы правило вообще попало в отчёт), прогноз всегда
 * равен полной сумме вознаграждения правила независимо от статуса (см. `task-completed.entity.ts`'s
 * `calculate()` — `amount = mode === 'FACT' ? factAmount : rewardAmount`), поэтому отдельного поля
 * "сумма правила" в контракте отчёта нет и не нужно.
 */
export function TaskRulePanel({ rule, period, isClosed, className }: TaskRulePanelProps) {
    if (rule.type !== 'TaskCompleted') return null

    const upperBound = rule.amount.prognose
    const canEditActualAmount = !isClosed && rule.taskStatus === 'COMPLETED' && upperBound != null

    return (
        <div
            data-slot="task-rule-panel"
            className={cn('flex flex-col gap-2 border-b border-hairline px-6 py-2.5 md:px-10', className)}
        >
            <div className="flex flex-wrap items-center gap-2">
                {rule.isTaskUnavailable ? (
                    <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-md bg-danger-soft px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap text-danger">
                        <TriangleAlert className="size-3" />
                        Задача недоступна
                    </span>
                ) : (
                    rule.taskStatus && (
                        <span className="inline-flex w-fit shrink-0 items-center rounded-md bg-hairline px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap text-ink-muted">
                            {TASK_RULE_STATUS_LABELS[rule.taskStatus]}
                        </span>
                    )
                )}

                {rule.bitrixTaskUrl && (
                    <a
                        href={rule.bitrixTaskUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-ui text-xs font-semibold text-info-ink hover:underline"
                    >
                        Задача в Bitrix24
                        <SquareArrowOutUpRight className="size-3" />
                    </a>
                )}
            </div>

            {canEditActualAmount && (
                <ActualAmountEditor
                    ruleId={rule.ruleId}
                    period={period}
                    actualAmount={rule.actualAmount}
                    upperBound={upperBound}
                />
            )}
        </div>
    )
}

type ActualAmountEditorProps = {
    ruleId: string
    period: string
    actualAmount: number | undefined
    upperBound: number
}

/** Поле "Фактическая сумма" — предзаполнено уже сохранённым значением (`rule.actualAmount`), при
 * его отсутствии полной суммой правила (тот же дефолт, что использует расчёт факта на бэкенде,
 * spec.md "Закрытая задача без фактической суммы даёт полную сумму в факте"). Диапазон
 * `0..upperBound` проверяется на клиенте до отправки (spec.md "Значение вне диапазона
 * отклоняется") — сервер проверяет тот же диапазон ещё раз (defence in depth, тот же приём, что и
 * `taskCompletedDueDateBounds` у формы правила). Успешное сохранение инвалидирует весь префикс
 * `['salary-report']` (см. `useSetTaskRuleActualAmount`) — сумма факта строки перечитывается из
 * ответа, без ручного локального пересчёта здесь. */
function ActualAmountEditor({ ruleId, period, actualAmount, upperBound }: ActualAmountEditorProps) {
    const mutation = useSetTaskRuleActualAmount()
    const { reset } = mutation

    const initialValue = String(actualAmount ?? upperBound)
    const [value, setValue] = useState(initialValue)
    const [validationError, setValidationError] = useState<string | null>(null)

    useEffect(() => {
        setValue(initialValue)
        setValidationError(null)
        reset()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ruleId, period, initialValue])

    const isDirty = value !== initialValue
    const isSaving = mutation.isPending
    const serverError = mutation.error !== null ? readActualAmountErrorMessage(mutation.error) : null
    const errorText = validationError ?? serverError

    function submit() {
        const parsed = Number(value)
        if (value.trim() === '' || !Number.isFinite(parsed)) {
            setValidationError('Введите корректную сумму')
            return
        }
        if (parsed < 0 || parsed > upperBound) {
            setValidationError(`Сумма должна быть от 0 до ${formatCurrency(upperBound)}`)
            return
        }
        setValidationError(null)
        mutation.mutate({ ruleId, period, actualAmount: Math.round(parsed) })
    }

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
                <label className="font-ui text-[11px] font-medium text-ink-muted" htmlFor={`actual-amount-${ruleId}`}>
                    Фактическая сумма, ₽
                </label>
            </div>
            <div className="flex items-center gap-2">
                <Input
                    id={`actual-amount-${ruleId}`}
                    type="number"
                    min={0}
                    max={upperBound}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    disabled={isSaving}
                    className="h-8 max-w-[160px]"
                />
                {isDirty && (
                    <Button type="button" size="sm" onClick={submit} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin" /> : <Check />}
                        Сохранить
                    </Button>
                )}
            </div>
            {errorText !== null && <span className="font-ui text-[11px] text-danger">{errorText}</span>}
        </div>
    )
}
