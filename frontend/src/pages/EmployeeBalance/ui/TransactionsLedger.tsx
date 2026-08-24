import { ArrowDownRight, ArrowUpRight, FileText, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import type { BalanceTransaction } from 'ireports-contracts'

import { isDeletable, transactionTypeLabel } from '@/features/EmployeeBalance'
import { formatPeriodLabel, formatSignedCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'

import { TransactionsCardList } from './TransactionsCardList.tsx'

const COLUMNS = 'grid-cols-[96px_190px_130px_minmax(200px,1fr)_100px_150px_64px_160px]'

export type TransactionsLedgerProps = {
    transactions: BalanceTransaction[]
    /** Bitrix ID -> ФИО, для колонки «Автор» (`createdBy`). */
    employeeNameById: Record<number, string>
    selectionTotal: number
    /** Кнопка «Удалить» скрыта в личном кабинете (`readOnly`). */
    readOnly?: boolean
    onDeleteTransaction: (transaction: BalanceTransaction) => void
    className?: string
}

/**
 * Лента движений (Фаза 8b/10 docs/payroll-closing-and-accrual, правки Фазы 8b): строки
 * НЕ раскрываются (в отличие от `AccrualLinesTable`) — у движения начисления
 * (`accrualId != null`) вместо деталей ссылка-кнопка «Документ» на карточку
 * `/salary-accruals/:id` (детализация по правилам уже там, Фаза 9), у ручного движения
 * без документа ERP (`isDeletable`) — кнопка «Удалить» с confirm-модалкой (не «сторно»
 * — слово нигде не используется, PRD-правка Фазы 8b). Колонка «ERP» — заглушка «—» до
 * PRD 3 (`erpSyncRequired` пока только хранится). На мобильном (`md:hidden`) таблица
 * заменяется карточками с группировкой по дням (`TransactionsCardList`, Pencil
 * `lQM7O`/`b6g6Z`) — тот же приём брейкпоинта, что `DepartmentBalancesBody`.
 */
export function TransactionsLedger({
    transactions,
    employeeNameById,
    selectionTotal,
    readOnly = false,
    onDeleteTransaction,
    className,
}: TransactionsLedgerProps) {
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
                className="md:hidden"
            />

            <div className="hidden overflow-hidden rounded-xl border border-hairline bg-surface md:block">
                <div className="overflow-x-auto">
                    <div className="min-w-[1160px]">
                        <div className={cn('grid items-center gap-2 border-b border-hairline bg-canvas px-3 py-2.5', COLUMNS)}>
                            <span className="font-ui text-xs font-medium text-ink-muted">Дата</span>
                            <span className="font-ui text-xs font-medium text-ink-muted">Тип</span>
                            <span className="text-right font-ui text-xs font-semibold text-ink">Сумма, ₽</span>
                            <span className="font-ui text-xs font-medium text-ink-muted">Комментарий</span>
                            <span className="font-ui text-xs font-medium text-ink-muted">Период</span>
                            <span className="font-ui text-xs font-medium text-ink-muted">Автор</span>
                            <span className="font-ui text-xs font-medium text-ink-muted">ERP</span>
                            <span className="text-right font-ui text-xs font-medium text-ink-muted">Действия</span>
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
                                    <span
                                        className={cn(
                                            'text-right font-ui text-sm font-bold tabular-nums',
                                            isIncome ? 'text-ok-ink' : 'text-danger',
                                        )}
                                    >
                                        {formatSignedCurrency(transaction.amount)}
                                    </span>
                                    <span className="min-w-0 truncate font-ui text-[13px] text-ink-muted" title={transaction.comment ?? undefined}>
                                        {transaction.comment ?? '—'}
                                    </span>
                                    <span className="font-ui text-[13px] text-ink-muted">
                                        {transaction.period !== null ? formatPeriodLabel(transaction.period) : '—'}
                                    </span>
                                    <span className="truncate font-ui text-[13px] text-ink-muted">{author}</span>
                                    <span className="font-ui text-[13px] text-ink-faint">—</span>
                                    <span className="flex items-center justify-end gap-1.5">
                                        {transaction.accrualId !== null && (
                                            <Button type="button" variant="secondary" size="sm" asChild>
                                                <Link to={`/salary-accruals/${transaction.accrualId}?direction=${transaction.direction}`}>
                                                    <FileText />
                                                    Документ
                                                </Link>
                                            </Button>
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
                                    </span>
                                </div>
                            )
                        })}

                        {footer}
                    </div>
                </div>
            </div>

            {transactions.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-hairline bg-surface md:hidden">{footer}</div>
            )}
        </div>
    )
}
