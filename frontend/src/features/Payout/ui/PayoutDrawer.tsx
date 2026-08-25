import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Banknote, CircleX, Loader2, Receipt, RotateCw, TriangleAlert, Wallet } from 'lucide-react'
import type { BalanceTransaction, CreatePayoutRequest, SalesDirection } from 'ireports-contracts'

import { formatCurrency, formatSignedCurrency } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Checkbox } from '@/shared/ui-kit/atoms/Checkbox'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { Textarea } from '@/shared/ui-kit/atoms/Textarea'
import { Modal } from '@/shared/ui-kit/organisms/Modal'

import { HARDCODED_CREATED_BY } from '../model/api.ts'
import { readPayoutConfirmationRequired, readPayoutErrorMessage } from '../model/payoutView.ts'
import { useCreatePayout } from '../model/usePayoutMutations.ts'

const DIRECTION_LABEL: Record<SalesDirection, string> = {
    service: 'Сервис',
    shop: 'Магазин',
}

export type PayoutDrawerProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    direction: SalesDirection
    /** Позволяет выбрать направление прямо в drawer'е — только когда открывающая страница сама
     * не привязана к направлению (баланс сотрудника, Фаза 8b: общий, без Direction Tabs).
     * Со страницы «Выплата» (уже per-direction, P3.1) не передаётся — направление в шапке. */
    onDirectionChange?: (direction: SalesDirection) => void
    employeeId: number
    employeeName: string
    departmentName?: string | null
    /** Текущий общий остаток сотрудника (Фаза 8b — без деления по направлениям). */
    currentBalance: number
    /** «RemOnline · касса Основная» / «МойСклад · статья «Зарплата»» / «Касса не настроена» —
     * собирается страницей из `erp_cash_config` (P3.1: подпись read-only, без выбора). */
    cashLabel: string
    /** Последние 3–4 движения за месяц для свёрнутой ленты (P3.2) — передаётся страницей,
     * которая уже держит ленту баланса (`EmployeeBalance`/`Payout`), а не запрашивается здесь:
     * фича `Payout` не может импортировать фичу `EmployeeBalance` (кросс-импорт между features
     * запрещён), а тип `BalanceTransaction` — общий контракт, не завязан на конкретную фичу. */
    recentTransactions?: BalanceTransaction[]
    /** Всего движений за период (для «Показать все · N движений»), если больше показанных. */
    totalTransactionsCount?: number
    onShowAllTransactions?: () => void
}

/**
 * Pencil `MuiAK`/`G8ckk`/`CZGJi`/`AqCRq` (десктоп, состояния а–д) / `j6ws6` (мобильный) —
 * выплата одному сотруднику (Фаза 14 docs/payroll-closing-and-accrual, P3.2). Построен на
 * общем `Modal` (в ките нет отдельного drawer/bottom-sheet примитива — тот же приём, что
 * `NewTransactionDrawer`/`AdjustLineModal`).
 *
 * Состояния из макета: (а) обычное — сумма предзаполнена остатком; (б/в) остаток ≤ 0 или сумма
 * больше остатка — жёлтый alert + обязательный чекбокс «Подтверждаю выплату сверх остатка»,
 * без него кнопка disabled; (г) 409 `PayoutConfirmationRequiredException` уже ПОСЛЕ отправки
 * (клиентская проверка не поймала — остаток изменился на сервере) читается тем же путём и
 * сводится к тому же алерту с актуальными цифрами из `metadata`; (д) сетевая/ERP-ошибка — тот
 * же алерт, только красный, с «Повторить» (= повторный вызов `submit()`); (е) спиннер —
 * `createMutation.isPending`.
 */
export function PayoutDrawer({
    open,
    onOpenChange,
    direction,
    onDirectionChange,
    employeeId,
    employeeName,
    departmentName,
    currentBalance,
    cashLabel,
    recentTransactions = [],
    totalTransactionsCount,
    onShowAllTransactions,
}: PayoutDrawerProps) {
    const createMutation = useCreatePayout(direction)
    const { reset } = createMutation

    const [amount, setAmount] = useState('')
    const [occurredAt, setOccurredAt] = useState(() => format(new Date(), 'yyyy-MM-dd'))
    const [comment, setComment] = useState('')
    const [confirmed, setConfirmed] = useState(false)
    /** Остаток из 409-ответа (может отличаться от `currentBalance`, если он изменился на
     * сервере между открытием drawer'а и отправкой) — null, пока такой ошибки не было. */
    const [serverConfirmation, setServerConfirmation] = useState<{ balance: number; balanceAfter: number } | null>(null)

    useEffect(() => {
        if (!open) return
        setAmount(currentBalance > 0 ? String(Math.round(currentBalance)) : '')
        setOccurredAt(format(new Date(), 'yyyy-MM-dd'))
        setComment('')
        setConfirmed(false)
        setServerConfirmation(null)
        reset()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, employeeId])

    const parsedAmount = Number(amount)
    const isAmountValid = amount.trim() !== '' && Number.isFinite(parsedAmount) && parsedAmount > 0

    const effectiveBalance = serverConfirmation?.balance ?? currentBalance
    const balanceAfter = serverConfirmation?.balanceAfter ?? (isAmountValid ? effectiveBalance - parsedAmount : effectiveBalance)
    const needsConfirmation = serverConfirmation !== null || effectiveBalance <= 0 || (isAmountValid && parsedAmount > effectiveBalance)

    const isSaving = createMutation.isPending
    const is409Confirmation = serverConfirmation !== null
    const errorMessage = createMutation.error !== null && !is409Confirmation ? readPayoutErrorMessage(createMutation.error) : null

    function handleOpenChange(next: boolean) {
        if (!next && isSaving) return
        onOpenChange(next)
    }

    function submit() {
        if (!isAmountValid) return
        if (needsConfirmation && !confirmed) return

        const payload: CreatePayoutRequest = {
            employeeId,
            amount: Math.round(parsedAmount),
            occurredAt,
            comment: comment.trim() !== '' ? comment.trim() : undefined,
            createdBy: HARDCODED_CREATED_BY,
            confirmNegativeBalance: needsConfirmation ? true : undefined,
        }

        createMutation.mutate(payload, {
            onSuccess: () => onOpenChange(false),
            onError: (mutationError) => {
                const confirmation = readPayoutConfirmationRequired(mutationError)
                if (confirmation !== null) {
                    setServerConfirmation({ balance: confirmation.balance, balanceAfter: confirmation.balanceAfter })
                }
            },
        })
    }

    const canSubmit = isAmountValid && (!needsConfirmation || confirmed)

    return (
        <Modal
            open={open}
            onOpenChange={handleOpenChange}
            title={`Выплата · ${employeeName}`}
            subtitle={
                [departmentName, DIRECTION_LABEL[direction]].filter((part): part is string => Boolean(part)).join(' · ')
            }
            footer={
                <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSaving}>
                        Отмена
                    </Button>
                    <Button type="button" onClick={submit} disabled={isSaving || !canSubmit}>
                        {isSaving ? (
                            <>
                                <Loader2 className="animate-spin" />
                                Создаём документ в ERP…
                            </>
                        ) : errorMessage !== null ? (
                            <>
                                <RotateCw />
                                Повторить
                            </>
                        ) : (
                            <>
                                <Banknote />
                                Выплатить
                            </>
                        )}
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5 rounded-xl bg-info-soft px-3.5 py-3">
                    <Wallet className="size-4 shrink-0 text-info-ink" />
                    <div className="flex flex-col gap-0.5">
                        <span className="font-ui text-[11px] font-semibold text-info-ink">Остаток сейчас</span>
                        <span className="font-display text-lg font-bold text-ink tabular-nums">
                            {formatCurrency(effectiveBalance)}
                        </span>
                    </div>
                </div>

                {recentTransactions.length > 0 && (
                    <div className="flex flex-col gap-0 rounded-xl border border-hairline bg-canvas px-3 py-1">
                        {recentTransactions.slice(0, 4).map((transaction, index) => (
                            <div
                                key={transaction.id}
                                className={cn(
                                    'flex items-center justify-between gap-2 py-2',
                                    index > 0 && 'border-t border-hairline',
                                )}
                            >
                                <span className="font-ui text-xs text-ink-muted">
                                    {format(new Date(transaction.occurredAt), 'dd.MM.yyyy')}
                                </span>
                                <span
                                    className={cn(
                                        'font-display text-xs font-semibold tabular-nums',
                                        transaction.amount >= 0 ? 'text-ok-ink' : 'text-ink-muted',
                                    )}
                                >
                                    {formatSignedCurrency(transaction.amount)}
                                </span>
                            </div>
                        ))}
                        {onShowAllTransactions !== undefined &&
                            (totalTransactionsCount ?? recentTransactions.length) > recentTransactions.slice(0, 4).length && (
                                <button
                                    type="button"
                                    onClick={onShowAllTransactions}
                                    className="border-t border-hairline py-2 text-left font-ui text-xs font-semibold text-info-ink"
                                >
                                    Показать все · {totalTransactionsCount ?? recentTransactions.length} движений
                                </button>
                            )}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                        <span className="font-ui text-xs font-semibold text-ink">Сумма выплаты, ₽</span>
                        <Input
                            type="number"
                            min={0}
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            aria-label="Сумма выплаты"
                            disabled={isSaving}
                            className="font-display text-lg font-bold"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="font-ui text-xs font-semibold text-ink">Дата</span>
                        <Input
                            type="date"
                            value={occurredAt}
                            onChange={(event) => setOccurredAt(event.target.value)}
                            aria-label="Дата"
                            disabled={isSaving}
                        />
                    </div>
                </div>

                {onDirectionChange !== undefined && (
                    <div className="flex flex-col gap-2">
                        <span className="font-ui text-xs font-semibold text-ink">Направление</span>
                        <div className="flex items-center gap-1 rounded-[10px] bg-hairline p-1" role="tablist" aria-label="Направление">
                            {(['service', 'shop'] as const).map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="tab"
                                    aria-selected={direction === value}
                                    onClick={() => onDirectionChange(value)}
                                    disabled={isSaving}
                                    className={cn(
                                        'flex-1 rounded-lg px-3 py-1.5 font-ui text-[13px] transition-colors select-none',
                                        direction === value
                                            ? 'bg-surface font-semibold text-ink shadow-sm'
                                            : 'font-medium text-ink-muted hover:text-ink',
                                    )}
                                >
                                    {DIRECTION_LABEL[value]}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    <span className="font-ui text-xs text-ink-muted">Комментарий, необязательно</span>
                    <Textarea
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        aria-label="Комментарий"
                        disabled={isSaving}
                    />
                </div>

                <div className="flex items-center gap-2.5 rounded-xl border border-hairline bg-canvas px-3.5 py-3">
                    <Receipt className="size-4 shrink-0 text-ink-muted" />
                    <span className="font-ui text-xs text-ink-muted">
                        Документ: {cashLabel} · расход · «Зарплата за {format(new Date(occurredAt), 'LLLL yyyy', { locale: ru })}»
                    </span>
                </div>

                {needsConfirmation && (
                    <div className="flex flex-col gap-2.5 rounded-xl bg-warn-soft px-4 py-3.5">
                        <div className="flex items-start gap-2.5">
                            <TriangleAlert className="mt-0.5 size-[15px] shrink-0 text-warn-ink" />
                            <p className="font-ui text-[13px] font-semibold text-warn-ink">
                                Остаток {formatCurrency(effectiveBalance)} — после выплаты будет {formatCurrency(balanceAfter)}
                            </p>
                        </div>
                        <label className="flex items-center gap-2.5">
                            <Checkbox checked={confirmed} onCheckedChange={setConfirmed} aria-label="Подтверждаю выплату сверх остатка" />
                            <span className="font-ui text-[13px] text-warn-ink">Подтверждаю выплату сверх остатка</span>
                        </label>
                    </div>
                )}

                {!needsConfirmation && isAmountValid && (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-4 py-3">
                        <span className="font-ui text-xs text-ink-muted">Остаток после выплаты</span>
                        <span className="font-ui text-[13px] font-semibold text-ink tabular-nums">
                            {formatCurrency(balanceAfter)}
                        </span>
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
