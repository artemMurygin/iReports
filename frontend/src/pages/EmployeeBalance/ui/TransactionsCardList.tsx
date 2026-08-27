import { format } from 'date-fns'
import { ArrowDownRight, ArrowUpRight, ExternalLink, FileText, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { BalanceTransaction } from 'ireports-contracts'

import {
    DIRECTION_LABEL,
    ERP_SYSTEM_LABEL,
    isDeletable,
    isPayoutTransaction,
    transactionTypeLabel,
} from '@/features/EmployeeBalance'
import { formatSignedCurrency } from '@/features/SalesPlan'
import { useInfiniteScrollTrigger } from '@/shared/hooks/useInfiniteScrollTrigger.ts'
import { cn } from '@/shared/lib/tw'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { Spinner } from '@/shared/ui/Spinner.tsx'

export type TransactionsCardListProps = {
    transactions: BalanceTransaction[]
    employeeNameById: Record<number, string>
    readOnly?: boolean
    onDeleteTransaction: (transaction: BalanceTransaction) => void
    /** «Удалить» у выплаты — свой путь (`DELETE .../payout/:id`, `features/EmployeeBalance`'s
     * `DeletePayoutDialog`, Фаза 15). */
    onDeletePayout: (transaction: BalanceTransaction) => void
    /** Бесконечная подгрузка (Фаза 8 docs/employee-settlements-page-redesign) — все три
     * необязательны и по умолчанию выключены (`hasNextPage: false`), чтобы существующий
     * `TransactionsCardList.spec.tsx` (рендерит компонент без этих пропсов) не сломался. */
    hasNextPage?: boolean
    isFetchingNextPage?: boolean
    onLoadMore?: () => void
    className?: string
}

/**
 * Pencil `JTc29` (`Баланс · Сотрудник`, мобильный, Фаза 5 docs/employee-settlements-page-redesign):
 * плоский список карточек движений (было — с группировкой по дням, Фаза 8b; макет `JTc29`
 * показывает дату внутри каждой карточки рядом с автором, отдельных заголовков-дней в нём нет)
 * вместо горизонтально скроллящейся таблицы `TransactionsLedger` на узких экранах. Тот же
 * приём переключения по брейкпоинту (`md:hidden` / `hidden md:block`), что
 * `DepartmentBalancesCardList`/`AccrualCardList`, и тот же набор действий (ссылка «Документ»
 * для начислений, «Удалить» для ручных движений без ERP).
 */
export function TransactionsCardList({
    transactions,
    employeeNameById,
    readOnly = false,
    onDeleteTransaction,
    onDeletePayout,
    hasNextPage = false,
    isFetchingNextPage = false,
    onLoadMore = () => {},
    className,
}: TransactionsCardListProps) {
    // Sentinel в конце списка (Pencil `JTc29`, Фаза 8 docs/employee-settlements-page-redesign) —
    // общий хук `shared/hooks/useInfiniteScrollTrigger`, тот же приём, что десктопная
    // `TransactionsLedger`. Наблюдатель создаётся, только пока `hasNextPage` (т.е. когда список
    // непустой и есть что подгружать) — на пустом состоянии ниже sentinel не рендерится вовсе.
    const sentinelRef = useInfiniteScrollTrigger<HTMLDivElement>({
        hasMore: hasNextPage,
        isLoading: isFetchingNextPage,
        onLoadMore,
    })

    if (transactions.length === 0) {
        return (
            <div
                data-slot="transactions-card-list"
                className={cn('rounded-xl border border-hairline bg-surface p-4 text-center', className)}
            >
                <p className="font-ui text-xs text-ink-muted">Движений за выбранный период и фильтры нет</p>
            </div>
        )
    }

    return (
        <div data-slot="transactions-card-list" className={cn('flex flex-col gap-2.5', className)}>
            {transactions.map((transaction) => (
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

            {hasNextPage && (
                <div
                    ref={sentinelRef}
                    data-slot="load-more-sentinel"
                    className="flex items-center justify-center gap-2 py-2"
                >
                    {isFetchingNextPage && (
                        <>
                            <Spinner className="size-3.5 text-ink-muted" />
                            <span className="font-ui text-xs text-ink-muted">Загружаем более ранние движения...</span>
                        </>
                    )}
                </div>
            )}
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
        <div
            data-slot="transaction-card"
            className="flex flex-col gap-2.5 rounded-xl border border-hairline bg-surface p-3.5 font-ui"
        >
            <span className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-1.5">
                        {isIncome ? (
                            <ArrowUpRight className="size-[15px] shrink-0 text-ok-ink" />
                        ) : (
                            <ArrowDownRight className="size-[15px] shrink-0 text-danger" />
                        )}
                        <span className="truncate text-[13px] font-semibold text-ink">
                            {transactionTypeLabel[transaction.type]}
                        </span>
                    </span>
                    {/* Направление происхождения движения под типом (Pencil `JTc29`, Фаза 5
                        docs/employee-settlements-page-redesign) — тот же приём, что десктопная
                        `TransactionsLedger`. */}
                    <span className="pl-[21px] text-[11px] text-ink-muted">
                        {DIRECTION_LABEL[transaction.direction]}
                    </span>
                </span>
                <span
                    className={cn('shrink-0 text-sm font-bold tabular-nums', isIncome ? 'text-ok-ink' : 'text-danger')}
                >
                    {formatSignedCurrency(transaction.amount)}
                </span>
            </span>

            {transaction.comment !== null && (
                <p className="font-ui text-[13px] text-ink-muted">{transaction.comment}</p>
            )}

            {/* Документ — ровно один из двух источников (см. WHY в `TransactionsLedger`): ссылка
                на ERP-документ либо на карточку начисления. Своя строка, не в bottom-action-row —
                Pencil `JTc29`. */}
            {transaction.erp !== null ? (
                <span
                    className="inline-flex w-fit items-center gap-1 font-ui text-[11px] text-info-ink"
                    title={`Открыть в ${ERP_SYSTEM_LABEL[transaction.erp.system]}`}
                >
                    <ExternalLink className="size-3 shrink-0" />
                    {ERP_SYSTEM_LABEL[transaction.erp.system]} {transaction.erp.externalId}
                </span>
            ) : (
                transaction.accrualId !== null && (
                    <Link
                        to={`/salary-accruals/${transaction.accrualId}?direction=${transaction.direction}`}
                        className="inline-flex w-fit items-center gap-1 font-ui text-[11px] text-info-ink"
                    >
                        <FileText className="size-3 shrink-0" />
                        Документ начисления
                    </Link>
                )
            )}

            <span className="flex items-center justify-between gap-2 font-ui text-[11px] text-ink-muted">
                <span>
                    {format(new Date(transaction.occurredAt), 'dd.MM.yyyy')} · {author}
                </span>
                {(canDelete || canDeletePayout) && (
                    <span className="flex items-center gap-1.5">
                        {canDelete && (
                            <IconButton type="button" variant="danger" aria-label="Удалить движение" onClick={onDelete}>
                                <Trash2 />
                            </IconButton>
                        )}
                        {canDeletePayout && (
                            <IconButton
                                type="button"
                                variant="danger"
                                aria-label="Удалить выплату"
                                onClick={onDeletePayout}
                            >
                                <Trash2 />
                            </IconButton>
                        )}
                    </span>
                )}
            </span>
        </div>
    )
}
