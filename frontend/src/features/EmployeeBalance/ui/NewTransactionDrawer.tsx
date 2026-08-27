import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Banknote, Check, Loader2, Receipt, RotateCw, TriangleAlert } from 'lucide-react'
import type { CreateBalanceTransactionRequest, CreatePayoutRequest, SalesDirection } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Checkbox } from '@/shared/ui-kit/atoms/Checkbox'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'
import { Textarea } from '@/shared/ui-kit/atoms/Textarea'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { api, HARDCODED_CREATED_BY } from '../model/api.ts'
import { INCOME_TRANSACTION_TYPES, OUTCOME_TRANSACTION_TYPES, type OutcomeTransactionType } from '../model/manualTransactionTypes.ts'
import { readPayoutConfirmationRequired, readPayoutErrorMessage, resolvePayoutCashLabel } from '../model/payoutHelpers.ts'
import { useCreatePayout, useCreateTransaction } from '../model/useEmployeeBalanceMutations.ts'

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
 * «Провести в кассе ERP», когда он включён. Не используется для типа «Выплата» — там ERP-
 * документ создаётся всегда, без переключателя (см. WHY у payoutDocumentHint ниже). */
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
 *
 * **Тип «Выплата» (Фаза 6 docs/employee-settlements-page-redesign)** — единственный пункт
 * списка расхода, который не идёт через общий `POST .../transactions`: PRD, «Технические
 * ограничения» требует сохранить реальное действие «выплатить» (`create-payout`, 409
 * `PayoutConfirmationRequired` при уходе в минус, создание ERP-документа), просто вызывать
 * его из этой единой точки входа вместо отдельной кнопки «Выплатить»/`PayoutDrawer`
 * (`features/Payout`, удалена той же фазой). Поэтому при `type === 'PAYOUT'` форма ведёт
 * себя иначе:
 * - направление (`direction`, уже существующий Select ниже) идёт в `CreatePayoutRequest`
 *   так же, как в `CreateBalanceTransactionRequest` — у выплаты своя касса ERP на
 *   направление, эндпоинт per-direction (`POST /v1/{direction}/accounting/payout`);
 * - переключатель «Провести в кассе ERP» скрыт — документ создаётся всегда, не по выбору
 *   (см. `payoutDocumentHint`);
 * - остаток сотрудника (`currentBalance`) предзаполняет сумму и решает, нужно ли
 *   подтверждение «уход в минус» (`needsConfirmation`) — до и после отправки: 409 с сервера
 *   (остаток изменился между открытием drawer'а и отправкой) сводится к тому же алерту с
 *   актуальными цифрами из `metadata` (`readPayoutConfirmationRequired`);
 * - `useCreatePayout(direction)` вместо `useCreateTransaction(employeeId)`.
 */
export function NewTransactionDrawer({
    open,
    onOpenChange,
    employeeId,
    initialKind,
    currentBalance,
}: NewTransactionDrawerProps) {
    const createMutation = useCreateTransaction(employeeId)
    const { reset: resetCreateMutation } = createMutation

    const [kind, setKind] = useState<NewTransactionKind>(initialKind)
    const typeOptions = kind === 'income' ? INCOME_TRANSACTION_TYPES : OUTCOME_TRANSACTION_TYPES
    const [type, setType] = useState<OutcomeTransactionType>(initialKind === 'income' ? INCOME_TRANSACTION_TYPES[0].value : OUTCOME_TRANSACTION_TYPES[0].value)
    const [direction, setDirection] = useState<SalesDirection>('service')
    const [amount, setAmount] = useState('')
    const [occurredAt, setOccurredAt] = useState(() => format(new Date(), 'yyyy-MM-dd'))
    const [comment, setComment] = useState('')
    const [erpSyncRequired, setErpSyncRequired] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)

    const isPayout = kind === 'outcome' && type === 'PAYOUT'

    // ── Выплата: остаток из 409-ответа (может отличаться от currentBalance, если он
    // изменился на сервере между открытием drawer'а и отправкой), подтверждение ухода в
    // минус, касса ERP направления. ─────────────────────────────────────────────────────
    const [payoutConfirmed, setPayoutConfirmed] = useState(false)
    const [serverConfirmation, setServerConfirmation] = useState<{ balance: number; balanceAfter: number } | null>(null)
    const payoutMutation = useCreatePayout(direction)
    const { reset: resetPayoutMutation } = payoutMutation
    const erpCashConfigQuery = useQuery({ ...api.getErpCashConfig(direction), enabled: open && isPayout })
    const payoutCashLabel = resolvePayoutCashLabel(direction, erpCashConfigQuery.data)

    function defaultAmountFor(nextType: string): string {
        return nextType === 'PAYOUT' && currentBalance > 0 ? String(Math.round(currentBalance)) : ''
    }

    useEffect(() => {
        if (!open) return
        const nextType = initialKind === 'income' ? INCOME_TRANSACTION_TYPES[0].value : OUTCOME_TRANSACTION_TYPES[0].value
        setKind(initialKind)
        setType(nextType)
        setDirection('service')
        setAmount(defaultAmountFor(nextType))
        setOccurredAt(format(new Date(), 'yyyy-MM-dd'))
        setComment('')
        setErpSyncRequired(false)
        setValidationError(null)
        setPayoutConfirmed(false)
        setServerConfirmation(null)
        resetCreateMutation()
        resetPayoutMutation()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, initialKind])

    function handleKindChange(nextKind: NewTransactionKind) {
        setKind(nextKind)
        const nextOptions = nextKind === 'income' ? INCOME_TRANSACTION_TYPES : OUTCOME_TRANSACTION_TYPES
        if (!nextOptions.some((option) => option.value === type)) {
            const nextType = nextOptions[0].value
            setType(nextType)
            setAmount(defaultAmountFor(nextType))
        }
        setPayoutConfirmed(false)
        setServerConfirmation(null)
    }

    function handleTypeChange(nextType: OutcomeTransactionType) {
        setType(nextType)
        setPayoutConfirmed(false)
        setServerConfirmation(null)
        if (nextType === 'PAYOUT' && amount.trim() === '') {
            setAmount(defaultAmountFor(nextType))
        }
    }

    const requiresComment = type === 'PENALTY' || type === 'ADJUSTMENT'
    const parsedAmount = Number(amount)
    const isAmountValid = amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0
    const signedAmount = isAmountValid ? (kind === 'income' ? parsedAmount : -parsedAmount) : 0

    // ── Предпросмотр остатка после — для выплаты считается от effectiveBalance (сервер мог
    // прислать более свежий остаток в 409), для остальных типов — от currentBalance. ──────
    const effectivePayoutBalance = serverConfirmation?.balance ?? currentBalance
    const payoutBalanceAfter = serverConfirmation?.balanceAfter ?? (isAmountValid ? effectivePayoutBalance - parsedAmount : effectivePayoutBalance)
    const needsPayoutConfirmation =
        serverConfirmation !== null || effectivePayoutBalance <= 0 || (isAmountValid && parsedAmount > effectivePayoutBalance)
    const balanceAfter = isPayout ? payoutBalanceAfter : currentBalance + signedAmount

    const isSaving = isPayout ? payoutMutation.isPending : createMutation.isPending
    const isPayoutConfirmationPending = isPayout && serverConfirmation !== null
    const manualServerError = !isPayout && createMutation.error !== null ? readCreateTransactionErrorMessage(createMutation.error) : null
    const payoutServerError = isPayout && payoutMutation.error !== null && !isPayoutConfirmationPending ? readPayoutErrorMessage(payoutMutation.error) : null
    const serverErrorText = isPayout ? payoutServerError : manualServerError
    const errorText = validationError ?? serverErrorText

    const canSubmit = isPayout ? isAmountValid && (!needsPayoutConfirmation || payoutConfirmed) : isAmountValid

    function handleOpenChange(next: boolean) {
        if (!next && isSaving) return
        onOpenChange(next)
    }

    function submit() {
        if (!isAmountValid) {
            setValidationError('Введите сумму больше нуля')
            return
        }

        if (type === 'PAYOUT') {
            if (needsPayoutConfirmation && !payoutConfirmed) return
            setValidationError(null)

            const payload: CreatePayoutRequest = {
                employeeId,
                amount: Math.round(parsedAmount),
                occurredAt,
                comment: comment.trim() !== '' ? comment.trim() : undefined,
                createdBy: HARDCODED_CREATED_BY,
                confirmNegativeBalance: needsPayoutConfirmation ? true : undefined,
            }

            payoutMutation.mutate(payload, {
                onSuccess: () => onOpenChange(false),
                onError: (mutationError) => {
                    const confirmation = readPayoutConfirmationRequired(mutationError)
                    if (confirmation !== null) {
                        setServerConfirmation({ balance: confirmation.balance, balanceAfter: confirmation.balanceAfter })
                    }
                },
            })
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
                    <Button type="button" onClick={submit} disabled={isSaving || (isPayout && !canSubmit)}>
                        {isSaving ? (
                            <Loader2 className="animate-spin" />
                        ) : serverErrorText !== null ? (
                            <RotateCw />
                        ) : isPayout ? (
                            <Banknote />
                        ) : (
                            <Check />
                        )}
                        {isSaving
                            ? isPayout || erpSyncRequired
                                ? 'Создаём документ в ERP…'
                                : 'Создаём…'
                            : serverErrorText !== null
                              ? 'Повторить'
                              : isPayout
                                ? 'Выплатить'
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
                    <Select value={type} onValueChange={(value) => handleTypeChange(value as OutcomeTransactionType)} disabled={isSaving}>
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

                {isPayout && (
                    <div className="flex items-center gap-2.5 rounded-xl bg-info-soft px-3.5 py-3">
                        <span className="font-ui text-[11px] font-semibold text-info-ink">Остаток сейчас</span>
                        <span className="ml-auto font-display text-lg font-bold text-ink tabular-nums">
                            {formatCurrency(effectivePayoutBalance)}
                        </span>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <Field label={isPayout ? 'Сумма выплаты, ₽' : 'Сумма, ₽'}>
                        <Input
                            type="number"
                            min={0}
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            aria-label="Сумма"
                            disabled={isSaving}
                            className={isPayout ? 'font-display text-lg font-bold' : undefined}
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

                {isPayout ? (
                    <div className="flex items-center gap-2.5 rounded-xl border border-hairline bg-canvas px-3.5 py-3">
                        <Receipt className="size-4 shrink-0 text-ink-muted" />
                        <span className="font-ui text-xs text-ink-muted">
                            Документ: {payoutCashLabel} · расход · «Зарплата за {format(new Date(occurredAt), 'LLLL yyyy', { locale: ru })}»
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2.5">
                            <Checkbox checked={erpSyncRequired} onCheckedChange={setErpSyncRequired} aria-label="Провести в кассе ERP" disabled={isSaving} />
                            <span className="font-ui text-[13px] text-ink">Провести в кассе ERP</span>
                        </label>
                        {erpSyncRequired && (
                            <p className="pl-[26px] font-ui text-xs text-ink-muted">{erpDocumentHint(direction, kind)}</p>
                        )}
                    </div>
                )}

                {isPayout && needsPayoutConfirmation && (
                    <div className="flex flex-col gap-2.5 rounded-xl bg-warn-soft px-4 py-3.5">
                        <div className="flex items-start gap-2.5">
                            <TriangleAlert className="mt-0.5 size-[15px] shrink-0 text-warn-ink" />
                            <p className="font-ui text-[13px] font-semibold text-warn-ink">
                                Остаток {formatCurrency(effectivePayoutBalance)} — после выплаты будет {formatCurrency(payoutBalanceAfter)}
                            </p>
                        </div>
                        <label className="flex items-center gap-2.5">
                            <Checkbox checked={payoutConfirmed} onCheckedChange={setPayoutConfirmed} aria-label="Подтверждаю выплату сверх остатка" />
                            <span className="font-ui text-[13px] text-warn-ink">Подтверждаю выплату сверх остатка</span>
                        </label>
                    </div>
                )}

                {(!isPayout || (!needsPayoutConfirmation && isAmountValid)) && (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-4 py-3">
                        <span className="font-ui text-xs text-ink-muted">Остаток после</span>
                        <span className="font-ui text-[13px] font-semibold text-ink tabular-nums">
                            {formatCurrency(isPayout ? effectivePayoutBalance : currentBalance)} → {formatCurrency(balanceAfter)}
                        </span>
                    </div>
                )}

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
