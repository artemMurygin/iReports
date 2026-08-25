import { Link } from 'react-router-dom'
import { Banknote, Loader2, Trash2, Wallet } from 'lucide-react'
import type { PayoutEmployeeRow } from 'ireports-contracts'

import { PAYOUT_STATUS_LABEL, employeeInitials } from '@/features/Payout'
import { formatCurrency } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Checkbox } from '@/shared/ui-kit/atoms/Checkbox'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'

const STATUS_BADGE_TONE: Record<PayoutEmployeeRow['payoutStatus'], string> = {
    NOT_PAID: 'bg-hairline text-ink-muted',
    PARTIALLY_PAID: 'bg-warn-soft text-warn-ink',
    PAID: 'bg-brand-soft text-ok-ink',
}

export type PayoutCardListProps = {
    rows: PayoutEmployeeRow[]
    selectedIds: Set<number>
    onToggleRow: (employeeId: number) => void
    onPay: (row: PayoutEmployeeRow) => void
    /** «Удалить выплату» (Фаза 15 docs/payroll-closing-and-accrual, P3.3) — виден только у
     * карточек с `paid !== 0`. */
    onDeletePayout: (row: PayoutEmployeeRow) => void
    isResolvingDeletePayout: boolean
    className?: string
}

/** Pencil `R6Ybh` (`Выплата · Месяц`, мобильный): карточки с кнопкой «Выплатить». */
function PayoutCardList({
    rows,
    selectedIds,
    onToggleRow,
    onPay,
    onDeletePayout,
    isResolvingDeletePayout,
    className,
}: PayoutCardListProps) {
    if (rows.length === 0) {
        return (
            <p className={cn('rounded-xl border border-hairline bg-surface px-4 py-8 text-center font-ui text-xs text-ink-muted', className)}>
                Под выбранный фильтр не попал ни один сотрудник.
            </p>
        )
    }

    return (
        <div data-slot="payout-card-list" className={cn('flex flex-col gap-2.5', className)}>
            {rows.map((row) => {
                const isPaid = row.payoutStatus === 'PAID'
                return (
                    <div key={row.employeeId} className="flex flex-col gap-3 rounded-xl border border-brand-border bg-surface p-3.5">
                        <div className="flex items-center gap-2.5">
                            <Checkbox
                                checked={selectedIds.has(row.employeeId)}
                                onCheckedChange={() => onToggleRow(row.employeeId)}
                                disabled={isPaid}
                                aria-label={`Выбрать сотрудника: ${row.name}`}
                            />
                            <Avatar className="size-[30px]">
                                <AvatarFallback className="text-[11px]">{employeeInitials(row.name)}</AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 flex-1 truncate font-ui text-sm font-semibold text-ink">{row.name}</span>
                            <Button type="button" variant="secondary" size="sm" className="shrink-0" asChild>
                                <Link to={`/balance/employee/${row.employeeId}`}>
                                    <Wallet />
                                </Link>
                            </Button>
                            {row.paid !== 0 && (
                                <IconButton
                                    type="button"
                                    variant="danger"
                                    size="sm"
                                    aria-label={`Удалить выплату: ${row.name}`}
                                    onClick={() => onDeletePayout(row)}
                                    disabled={isResolvingDeletePayout}
                                >
                                    {isResolvingDeletePayout ? <Loader2 className="animate-spin" /> : <Trash2 />}
                                </IconButton>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-col gap-0.5">
                                <span className="font-ui text-[11px] text-ink-muted">Остаток</span>
                                <span
                                    className={cn(
                                        'font-display text-lg font-bold tabular-nums',
                                        row.balance < 0 ? 'text-danger' : row.balance === 0 ? 'text-ink-faint' : 'text-ink',
                                    )}
                                >
                                    {formatCurrency(row.balance)}
                                </span>
                            </div>
                            <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 font-ui text-xs font-medium', STATUS_BADGE_TONE[row.payoutStatus])}>
                                {PAYOUT_STATUS_LABEL[row.payoutStatus]}
                            </span>
                        </div>

                        <Button type="button" variant={row.balance <= 0 ? 'secondary' : 'default'} onClick={() => onPay(row)}>
                            <Banknote />
                            Выплатить
                        </Button>
                    </div>
                )
            })}
        </div>
    )
}

export { PayoutCardList }
