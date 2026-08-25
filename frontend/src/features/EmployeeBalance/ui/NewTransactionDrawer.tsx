import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { isAxiosError } from 'axios'
import { format } from 'date-fns'
import { Check, Loader2, RotateCw, TriangleAlert } from 'lucide-react'
import type { CreateBalanceTransactionRequest, ManualBalanceTransactionType, SalesDirection } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Checkbox } from '@/shared/ui-kit/atoms/Checkbox'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'
import { Textarea } from '@/shared/ui-kit/atoms/Textarea'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { HARDCODED_CREATED_BY } from '../model/api.ts'
import { INCOME_TRANSACTION_TYPES, OUTCOME_TRANSACTION_TYPES } from '../model/manualTransactionTypes.ts'
import { useCreateTransaction } from '../model/useEmployeeBalanceMutations.ts'

/** Направление drawer'а: не путать с `SalesDirection` (service/shop) поля формы — это
 * приход/расход, определяющий список типов и знак суммы. */
export type NewTransactionKind = 'income' | 'outcome'

export type NewTransactionDrawerProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    employeeId: number
    /** Кнопка шапки, которой открыт drawer («Добавить приход»/«Добавить расход») —
     * предвыбирает сегмент и сбрасывает форму при каждом открытии. */
    initialKind: NewTransactionKind
    /** Текущий общий остаток — для предпросмотра «Остаток после». */
    currentBalance: number
}

const KIND_OPTIONS: SegmentedControlOption<NewTransactionKind>[] = [
    { value: 'income', label: 'Приход' },
    { value: 'outcome', label: 'Расход' },
]

/** Кросс-импорт `features/AccountingPeriod`'s `DIRECTION_LABEL` запрещён линтингом
 * (features не импортируют другие features, frontend/CLAUDE.md) — задублировано здесь
 * намеренно, тот же приём, что `HARDCODED_CREATED_BY` в `model/api.ts`. */
const DIRECTION_LABEL: Record<SalesDirection, string> = {
    service: 'Сервис',
    shop: 'Магазин',
}
const DIRECTION_OPTIONS: SalesDirection[] = ['service', 'shop']

/** Подсказка типа документа по направлению и приходу/расходу (Фаза 15
 * docs/payroll-closing-and-accrual, P3.3, дополнение P2.3) — показывается под переключателем
 * «Провести в кассе ERP», когда он включён. */
function erpDocumentHint(direction: SalesDirection, kind: NewTransactionKind): string {
    if (direction === 'service') return 'Создаст движение по кассе RemOnline · «Основная»'
    return kind === 'income' ? 'Создаст приходный ордер в МойСкладе' : 'Создаст расходный ордер в МойСкладе · статья «Зарплата»'
}

/** 400 с человекочитаемым `message` в теле (например, отсутствующий обязательный
 * комментарий для PENALTY/ADJUSTMENT, если клиентская валидация почему-то пропустила
 * его) — тот же приём, что `readAdjustLineErrorMessage` в `AdjustLineModal`. */
function readCreateTransactionErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const body = error.response?.data as { message?: unknown } | undefined
        if (typeof body?.message === 'string' && body.message.trim() !== '') return body.message
    }
    return 'Не удалось создать движение, попробуйте ещё раз'
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2">
            <span className="font-ui text-xs font-semibold text-ink">
                {label}
                {required && <span className="text-danger"> *</span>}
            </span>
            {children}
        </div>
    )
}

/**
 * «Добавить движение» (PRD 2/Фаза 7, drawer из Фазы 10 docs/payroll-closing-and-accrual) —
 * в макете drawer, здесь общий `Modal` (в ките нет отдельного bottom-sheet примитива, тот
 * же приём, что `AdjustLineModal`/`ReopenPeriodDialog`). Сегмент Приход/Расход переключает
 * список типов (`INCOME_TRANSACTION_TYPES`/`OUTCOME_TRANSACTION_TYPES`) и знак суммы:
 * для обычных типов сервер сам подставляет знак по типу (клиент шлёт положительную
 * величину), для `ADJUSTMENT` (намеренно в обоих списках) знак задаёт сам сегмент —
 * приход шлёт `+amount`, расход `-amount`. `erpSyncRequired` в этой итерации только
 * сохраняется (синхронизация с кассой — PRD 3).
 */
export function NewTransactionDrawer({
    open,
    onOpenChange,
    employeeId,
    initialKind,
    currentBalance,
}: NewTransactionDrawerProps) {
    const createMutation = useCreateTransaction(employeeId)
    const { reset } = createMutation

    const [kind, setKind] = useState<NewTransactionKind>(initialKind)
    const typeOptions = kind === 'income' ? INCOME_TRANSACTION_TYPES : OUTCOME_TRANSACTION_TYPES
    const [type, setType] = useState<ManualBalanceTransactionType>(initialKind === 'income' ? INCOME_TRANSACTION_TYPES[0].value : OUTCOME_TRANSACTION_TYPES[0].value)
    const [direction, setDirection] = useState<SalesDirection>('service')
    const [amount, setAmount] = useState('')
    const [occurredAt, setOccurredAt] = useState(() => format(new Date(), 'yyyy-MM-dd'))
    const [comment, setComment] = useState('')
    const [erpSyncRequired, setErpSyncRequired] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setKind(initialKind)
        setType(initialKind === 'income' ? INCOME_TRANSACTION_TYPES[0].value : OUTCOME_TRANSACTION_TYPES[0].value)
        setDirection('service')
        setAmount('')
        setOccurredAt(format(new Date(), 'yyyy-MM-dd'))
        setComment('')
        setErpSyncRequired(false)
        setValidationError(null)
        reset()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initialKind])

    function handleKindChange(nextKind: NewTransactionKind) {
        setKind(nextKind)
        const nextOptions = nextKind === 'income' ? INCOME_TRANSACTION_TYPES : OUTCOME_TRANSACTION_TYPES
        if (!nextOptions.some((option) => option.value === type)) {
            setType(nextOptions[0].value)
        }
    }

    const requiresComment = type === 'PENALTY' || type === 'ADJUSTMENT'
    const parsedAmount = Number(amount)
    const isAmountValid = amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0
    const signedAmount = isAmountValid ? (kind === 'income' ? parsedAmount : -parsedAmount) : 0
    const balanceAfter = currentBalance + signedAmount

    const isSaving = createMutation.isPending
    const serverError = createMutation.error !== null ? readCreateTransactionErrorMessage(createMutation.error) : null
    const errorText = validationError ?? serverError

    function handleOpenChange(next: boolean) {
        if (!next && isSaving) return
        onOpenChange(next)
    }

    function submit() {
        if (!isAmountValid) {
            setValidationError('Введите сумму больше нуля')
            return
        }
        if (requiresComment && comment.trim() === '') {
            setValidationError('Комментарий с причиной обязателен для этого типа')
            return
        }
        setValidationError(null)

        const payload: CreateBalanceTransactionRequest = {
            direction,
            type,
            amount: type === 'ADJUSTMENT' ? Math.round(signedAmount) : Math.round(parsedAmount),
            occurredAt,
            comment: comment.trim() !== '' ? comment.trim() : undefined,
            createdBy: HARDCODED_CREATED_BY,
            erpSyncRequired,
        }

        createMutation.mutate(payload, { onSuccess: () => onOpenChange(false) })
    }

    const typeSelectItems = useMemo(
        () => typeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>),
        [typeOptions],
    )

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title="Добавить движение"
            footer={
                <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSaving}>
                        Отмена
                    </Button>
                    <Button type="button" onClick={submit} disabled={isSaving}>
                        {isSaving ? (
                            <Loader2 className="animate-spin" />
                        ) : serverError !== null ? (
                            <RotateCw />
                        ) : (
                            <Check />
                        )}
                        {isSaving
                            ? erpSyncRequired
                                ? 'Создаём документ в ERP…'
                                : 'Создаём…'
                            : serverError !== null
                              ? 'Повторить'
                              : 'Создать'}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <Field label="Тип движения">
                    <SegmentedControl aria-label="Приход или расход" options={KIND_OPTIONS} value={kind} onValueChange={handleKindChange} />
                </Field>

                <Field label="Тип">
                    <Select value={type} onValueChange={(value) => setType(value as ManualBalanceTransactionType)} disabled={isSaving}>
                        <SelectTrigger aria-label="Тип">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>{typeSelectItems}</SelectContent>
                    </Select>
                </Field>

                <Field label="Направление">
                    <Select value={direction} onValueChange={(value) => setDirection(value as SalesDirection)} disabled={isSaving}>
                        <SelectTrigger aria-label="Направление">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {DIRECTION_OPTIONS.map((option) => (
                                <SelectItem key={option} value={option}>
                                    {DIRECTION_LABEL[option]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Field label="Сумма, ₽">
                        <Input
                            type="number"
                            min={0}
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            aria-label="Сумма"
                            disabled={isSaving}
                        />
                    </Field>
                    <Field label="Дата">
                        <Input
                            type="date"
                            value={occurredAt}
                            onChange={(event) => setOccurredAt(event.target.value)}
                            aria-label="Дата"
                            disabled={isSaving}
                        />
                    </Field>
                </div>

                <Field label="Комментарий" required={requiresComment}>
                    <Textarea
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder={requiresComment ? 'Укажите причину' : 'Необязательно'}
                        aria-label="Комментарий"
                        disabled={isSaving}
                    />
                </Field>

                <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-2.5">
                        <Checkbox checked={erpSyncRequired} onCheckedChange={setErpSyncRequired} aria-label="Провести в кассе ERP" disabled={isSaving} />
                        <span className="font-ui text-[13px] text-ink">Провести в кассе ERP</span>
                    </label>
                    {erpSyncRequired && (
                        <p className="pl-[26px] font-ui text-xs text-ink-muted">{erpDocumentHint(direction, kind)}</p>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-4 py-3">
                    <span className="font-ui text-xs text-ink-muted">Остаток после</span>
                    <span className="font-ui text-[13px] font-semibold text-ink tabular-nums">
                        {formatCurrency(currentBalance)} → {formatCurrency(balanceAfter)}
                    </span>
                </div>

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
