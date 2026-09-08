import { ArrowDownRight, ArrowUpRight, ExternalLink, FileText, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
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
import { Button } from '@/shared/ui-kit/atoms/Button'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { Spinner } from '@/shared/ui/Spinner.tsx'

import { TransactionsCardList } from './TransactionsCardList.tsx'

// Дата | Тип (+направление) | Сумма | Комментарий | Автор | Документ (ERP/начисление + удаление
// в одной колонке, Pencil `L73YCK`, Фаза 5 docs/employee-settlements-page-redesign) — «Период»
// из Фазы 10 docs/payroll-closing-and-accrual убран из ленты вовсе (в макете его нет ни на
// десктопе, ни в мобильных карточках, см. `TransactionsCardList`).
const COLUMNS = 'grid-cols-[96px_180px_120px_minmax(200px,1fr)_140px_220px]'

export type TransactionsLedgerProps = {
    transactions: BalanceTransaction[]
    /** Bitrix ID -> ФИО, для колонки «Автор» (`createdBy`). */
    employeeNameById: Record<number, string>
    selectionTotal: number
    /** Кнопка «Удалить» скрыта в личном кабинете (`readOnly`). */
    readOnly?: boolean
    onDeleteTransaction: (transaction: BalanceTransaction) => void
    /** «Удалить» у выплаты (`type === 'PAYOUT'`) — свой путь, `DELETE .../payout/:id`
     * (`features/EmployeeBalance`'s `DeletePayoutDialog`, Фаза 15 docs/payroll-closing-and-accrual,
     * P3.3), в отличие от
     * `onDeleteTransaction` (обычные ручные движения). */
    onDeletePayout: (transaction: BalanceTransaction) => void
    /** Бесконечная подгрузка (Pencil `L73YCK`/`JTc29`, Фаза 8 docs/employee-settlements-page-
     * redesign) — `hasNextPage`/`isFetchingNextPage`/`onLoadMore` из `useEmployeeBalancePage`
     * (`useInfiniteQuery`), прокидываются и в десктопную таблицу ниже, и в мобильный
     * `TransactionsCardList` (один и тот же sentinel-контракт для обеих раскладок). */
    hasNextPage?: boolean
    isFetchingNextPage?: boolean
    onLoadMore?: () => void
    className?: string
}

/**
 * Лента движений (Фаза 8b/10 docs/payroll-closing-and-accrual, колонки — Фаза 5
 * docs/employee-settlements-page-redesign, Pencil `L73YCK`): строки НЕ раскрываются (в отличие
 * от `AccrualLinesTable`) — колонка «Документ» показывает ровно один из трёх вариантов: ссылку
 * на документ ERP (`transaction.erp`), кнопку-ссылку «Документ» на карточку начисления
 * `/salary-accruals/:id` (`accrualId != null`, детализация по правилам уже там, Фаза 9), либо
 * «—» — эти два поля взаимоисключающи по типу движения на практике (начисление не создаёт ERP-
 * документ, выплата не ссылается на строку начисления), рядом — «Удалить» с confirm-модалкой
 * (не «сторно», PRD-правка Фазы 8b) для ручного движения без документа ERP (`isDeletable`). На
 * мобильном (`md:hidden`) таблица заменяется карточками с группировкой по дням
 * (`TransactionsCardList`, Pencil `lQM7O`/`b6g6Z`/`JTc29`) — тот же приём брейкпоинта, что
 * `DepartmentBalancesBody`.
 */
export function TransactionsLedger({
    transactions,
    employeeNameById,
    selectionTotal,
    readOnly = false,
    onDeleteTransaction,
    onDeletePayout,
    hasNextPage = false,
    isFetchingNextPage = false,
    onLoadMore = () => {},
    className,
}: TransactionsLedgerProps) {
    // Sentinel десктопной таблицы (Pencil `L73YCK`) — рендерится под футером «Итого по выборке»,
    // отдельной центрированной строкой (тот же приём, что мобильный `TransactionsCardList`).
    const sentinelRef = useInfiniteScrollTrigger<HTMLDivElement>({
        hasMore: hasNextPage,
        isLoading: isFetchingNextPage,
        onLoadMore,
    })

    const footer = (
        <div className="flex items-center justify-between gap-4 border-t border-hairline bg-canvas px-4 py-3">
            <span className="font-ui text-xs text-ink-muted">
                {transactions.length} {transactions.length === 1 ? 'движение' : 'движений'} в выборке
            </span>
            <span className="shrink-0 font-ui text-[13px] font-bold text-ink tabular-nums">
                Итого по выборке: {formatSignedCurrency(selectionTotal)}
            </span>
        </div>
    )

    return (
        <div data-slot="employee-balance-ledger" className={cn('flex flex-col gap-3', className)}>
            <TransactionsCardList
                transactions={transactions}
                employeeNameById={employeeNameById}
                readOnly={readOnly}
                onDeleteTransaction={onDeleteTransaction}
                onDeletePayout={onDeletePayout}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onLoadMore={onLoadMore}
                className="md:hidden"
            />

            <div className="hidden overflow-hidden rounded-xl border border-hairline bg-surface md:block">
                <div className="overflow-x-auto">
                    <div className="min-w-[1160px]">
                        <div
                            className={cn(
                                'grid items-center gap-2 border-b border-hairline bg-canvas px-3 py-2.5',
                                COLUMNS,
                            )}
                        >
                            <span className="font-ui text-xs font-medium text-ink-muted">Дата</span>
                            <span className="font-ui text-xs font-medium text-ink-muted">Тип</span>
                            <span className="text-right font-ui text-xs font-semibold text-ink">Сумма, ₽</span>
                            <span className="font-ui text-xs font-medium text-ink-muted">Комментарий</span>
                            <span className="font-ui text-xs font-medium text-ink-muted">Автор</span>
                            <span className="text-right font-ui text-xs font-medium text-ink-muted">Документ</span>
                        </div>

                        {transactions.length === 0 && (
                            <div className="px-4 py-8 text-center font-ui text-[13px] text-ink-muted">
                                Движений за выбранный период и фильтры нет
                            </div>
                        )}

                        {transactions.map((transaction, index) => {
                            const isIncome = transaction.amount >= 0
                            const author = employeeNameById[transaction.createdBy] ?? `ID ${transaction.createdBy}`
                            const canDelete = !readOnly && isDeletable(transaction)
                            const canDeletePayout = !readOnly && isPayoutTransaction(transaction)

                            return (
                                <div
                                    key={transaction.id}
                                    className={cn(
                                        'grid items-center gap-2 px-3 py-3',
                                        COLUMNS,
                                        index > 0 && 'border-t border-hairline',
                                    )}
                                >
                                    <span className="font-ui text-[13px] text-ink-muted tabular-nums">
                                        {format(new Date(transaction.occurredAt), 'dd.MM.yyyy')}
                                    </span>
                                    <span className="flex min-w-0 flex-col gap-0.5">
                                        <span className="flex min-w-0 items-center gap-1.5">
                                            {isIncome ? (
                                                <ArrowUpRight className="size-[15px] shrink-0 text-ok-ink" />
                                            ) : (
                                                <ArrowDownRight className="size-[15px] shrink-0 text-danger" />
                                            )}
                                            <span className="truncate font-ui text-[13px] font-medium text-ink">
                                                {transactionTypeLabel[transaction.type]}
                                            </span>
                                        </span>
                                        {/* Направление происхождения движения под типом (Pencil `L73YCK`, Фаза 5
                                            docs/employee-settlements-page-redesign) — баланс общий (Фаза 8b), но
                                            каждое движение несёт направление своего происхождения. */}
                                        <span className="pl-[21px] font-ui text-[11px] text-ink-muted">
                                            {DIRECTION_LABEL[transaction.direction]}
                                        </span>
                                    </span>
                                    <span
                                        className={cn(
                                            'text-right font-ui text-sm font-bold tabular-nums',
                                            isIncome ? 'text-ok-ink' : 'text-danger',
                                        )}
                                    >
                                        {formatSignedCurrency(transaction.amount)}
                                    </span>
                                    <span
                                        className="min-w-0 truncate font-ui text-[13px] text-ink-muted"
                                        title={transaction.comment ?? undefined}
                                    >
                                        {transaction.comment ?? '—'}
                                    </span>
                                    <span className="truncate font-ui text-[13px] text-ink-muted">{author}</span>
                                    <span className="flex items-center justify-end gap-1.5">
                                        {transaction.erp !== null ? (
                                            <span
                                                className="inline-flex min-w-0 items-center gap-1 text-info-ink"
                                                title={`Открыть в ${ERP_SYSTEM_LABEL[transaction.erp.system]}`}
                                            >
                                                <ExternalLink className="size-3.5 shrink-0" />
                                                <span className="truncate">{transaction.erp.externalId}</span>
                                            </span>
                                        ) : transaction.accrualId !== null ? (
                                            <Button type="button" variant="secondary" size="sm" asChild>
                                                <Link
                                                    to={`/salary-accruals/${transaction.accrualId}?direction=${transaction.direction}`}
                                                >
                                                    <FileText />
                                                    Документ
                                                </Link>
                                            </Button>
                                        ) : (
                                            <span className="text-ink-faint">—</span>
                                        )}
                                        {canDelete && (
                                            <IconButton
                                                type="button"
                                                variant="danger"
                                                aria-label="Удалить движение"
                                                onClick={() => onDeleteTransaction(transaction)}
                                            >
                                                <Trash2 />
                                            </IconButton>
                                        )}
                                        {canDeletePayout && (
                                            <IconButton
                                                type="button"
                                                variant="danger"
                                                aria-label="Удалить выплату"
                                                onClick={() => onDeletePayout(transaction)}
                                            >
                                                <Trash2 />
                                            </IconButton>
                                        )}
                                    </span>
                                </div>
                            )
                        })}

                        {footer}
                    </div>
                </div>
            </div>

            {hasNextPage && (
                <div
                    ref={sentinelRef}
                    data-slot="load-more-sentinel"
                    className="hidden items-center justify-center gap-2 py-1 md:flex"
                >
                    {isFetchingNextPage && (
                        <>
                            <Spinner className="size-3.5 text-ink-muted" />
                            <span className="font-ui text-xs text-ink-muted">Загружаем более ранние движения...</span>
                        </>
                    )}
                </div>
            )}

            {transactions.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-hairline bg-surface md:hidden">{footer}</div>
            )}
        </div>
    )
}
