import { Fragment } from 'react'
import { format } from 'date-fns'
import { ArrowDownRight, ArrowUpRight, ExternalLink, FileText, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { BalanceTransaction } from 'ireports-contracts'

import { ERP_SYSTEM_LABEL, isDeletable, isPayoutTransaction, transactionTypeLabel } from '@/features/EmployeeBalance'
import { formatPeriodLabel, formatSignedCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'

export type TransactionsCardListProps = {
    transactions: BalanceTransaction[]
    employeeNameById: Record<number, string>
    readOnly?: boolean
    onDeleteTransaction: (transaction: BalanceTransaction) => void
    /** «Удалить» у выплаты — свой путь (`DELETE .../payout/:id`, features/Payout, Фаза 15). */
    onDeletePayout: (transaction: BalanceTransaction) => void
    className?: string
}

/** `occurredAt` -> `dd.MM.yyyy`, ключ группировки дня — карточки группируются по дате
 * движения, не по времени создания записи (см. `TransactionsLedger`). */
function dayKey(occurredAt: BalanceTransaction['occurredAt']): string {
    return format(new Date(occurredAt), 'dd.MM.yyyy')
}

/**
 * Pencil `lQM7O`/`b6g6Z` (`Баланс · Сотрудник`, мобильный, правки Фазы 8b): карточки движений
 * с группировкой по дням — вместо горизонтально скроллящейся таблицы `TransactionsLedger` на
 * узких экранах. Тот же приём переключения по брейкпоинту (`md:hidden` / `hidden md:block`),
 * что `DepartmentBalancesCardList`/`AccrualCardList`, и тот же набор действий (ссылка
 * «Документ» для начислений, «Удалить» для ручных движений без ERP).
 */
export function TransactionsCardList({
    transactions,
    employeeNameById,
    readOnly = false,
    onDeleteTransaction,
    onDeletePayout,
    className,
}: TransactionsCardListProps) {
    if (transactions.length === 0) {
        return (
            <div data-slot="transactions-card-list" className={cn('rounded-xl border border-hairline bg-surface p-4 text-center', className)}>
                <p className="font-ui text-xs text-ink-muted">Движений за выбранный период и фильтры нет</p>
            </div>
        )
    }

    const days: string[] = []
    const byDay = new Map<string, BalanceTransaction[]>()
    for (const transaction of transactions) {
        const key = dayKey(transaction.occurredAt)
        if (!byDay.has(key)) {
            days.push(key)
            byDay.set(key, [])
        }
        byDay.get(key)!.push(transaction)
    }

    return (
        <div data-slot="transactions-card-list" className={cn('flex flex-col gap-3', className)}>
            {days.map((day) => (
                <Fragment key={day}>
                    <span className="px-0.5 font-ui text-xs font-semibold text-ink-muted">{day}</span>
                    <div className="flex flex-col gap-2.5">
                        {byDay.get(day)!.map((transaction) => (
                            <TransactionCard
                                key={transaction.id}
                                transaction={transaction}
                                author={employeeNameById[transaction.createdBy] ?? `ID ${transaction.createdBy}`}
                                canDelete={!readOnly && isDeletable(transaction)}
                                canDeletePayout={!readOnly && isPayoutTransaction(transaction)}
                                onDelete={() => onDeleteTransaction(transaction)}
                                onDeletePayout={() => onDeletePayout(transaction)}
                            />
                        ))}
                    </div>
                </Fragment>
            ))}
        </div>
    )
}

function TransactionCard({
    transaction,
    author,
    canDelete,
    canDeletePayout,
    onDelete,
    onDeletePayout,
}: {
    transaction: BalanceTransaction
    author: string
    canDelete: boolean
    canDeletePayout: boolean
    onDelete: () => void
    onDeletePayout: () => void
}) {
    const isIncome = transaction.amount >= 0

    return (
        <div data-slot="transaction-card" className="flex flex-col gap-2.5 rounded-xl border border-hairline bg-surface p-3.5 font-ui">
            <span className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                    {isIncome ? (
                        <ArrowUpRight className="size-[15px] shrink-0 text-ok-ink" />
                    ) : (
                        <ArrowDownRight className="size-[15px] shrink-0 text-danger" />
                    )}
                    <span className="truncate text-[13px] font-semibold text-ink">{transactionTypeLabel[transaction.type]}</span>
                </span>
                <span className={cn('shrink-0 text-sm font-bold tabular-nums', isIncome ? 'text-ok-ink' : 'text-danger')}>
                    {formatSignedCurrency(transaction.amount)}
                </span>
            </span>

            {transaction.comment !== null && (
                <p className="font-ui text-[13px] text-ink-muted">{transaction.comment}</p>
            )}

            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-ui text-[11px] text-ink-muted">
                <span>{author}</span>
                {transaction.period !== null && <span>{formatPeriodLabel(transaction.period)}</span>}
                {transaction.erp !== null && (
                    <span className="inline-flex items-center gap-1 text-info-ink" title={`Открыть в ${ERP_SYSTEM_LABEL[transaction.erp.system]}`}>
                        <ExternalLink className="size-3 shrink-0" />
                        {transaction.erp.externalId}
                    </span>
                )}
            </span>

            {(transaction.accrualId !== null || canDelete || canDeletePayout) && (
                <span className="flex items-center justify-end gap-1.5 border-t border-hairline pt-2.5">
                    {transaction.accrualId !== null && (
                        <Button type="button" variant="secondary" size="sm" asChild>
                            <Link to={`/salary-accruals/${transaction.accrualId}?direction=${transaction.direction}`}>
                                <FileText />
                                Документ
                            </Link>
                        </Button>
                    )}
                    {canDelete && (
                        <IconButton type="button" variant="danger" aria-label="Удалить движение" onClick={onDelete}>
                            <Trash2 />
                        </IconButton>
                    )}
                    {canDeletePayout && (
                        <IconButton type="button" variant="danger" aria-label="Удалить выплату" onClick={onDeletePayout}>
                            <Trash2 />
                        </IconButton>
                    )}
                </span>
            )}
        </div>
    )
}
