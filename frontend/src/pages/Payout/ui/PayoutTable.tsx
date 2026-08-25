import { Link } from 'react-router-dom'
import { Banknote, Loader2, Trash2, Wallet } from 'lucide-react'
import type { PayoutEmployeeRow } from 'ireports-contracts'

import { PAYOUT_STATUS_LABEL, employeeInitials } from '@/features/Payout'
import { formatCurrency, formatSignedCurrency } from '@/shared/lib/format.ts'
import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback } from '@/shared/ui-kit/atoms/Avatar'
import { Button } from '@/shared/ui-kit/atoms/Button'
import { Checkbox } from '@/shared/ui-kit/atoms/Checkbox'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'
import { ColumnHeader } from '@/shared/ui-kit/molecules/ColumnHeader'

const COLUMN_WIDTH = {
    accrued: 'w-[120px]',
    advances: 'w-[110px]',
    manual: 'w-[110px]',
    balance: 'w-[140px]',
    paid: 'w-[130px]',
    status: 'w-[190px]',
    actions: 'w-[262px]',
}

const STATUS_BADGE_TONE: Record<PayoutEmployeeRow['payoutStatus'], string> = {
    NOT_PAID: 'bg-hairline text-ink-muted',
    PARTIALLY_PAID: 'bg-warn-soft text-warn-ink',
    PAID: 'bg-brand-soft text-ok-ink',
}

export type PayoutTableProps = {
    rows: PayoutEmployeeRow[]
    selectedIds: Set<number>
    onToggleRow: (employeeId: number) => void
    onToggleAll: () => void
    isAllSelected: boolean
    isIndeterminate: boolean
    onPay: (row: PayoutEmployeeRow) => void
    /** «Удалить выплату» (Фаза 15 docs/payroll-closing-and-accrual, P3.3) — виден только у
     * строк с `paid !== 0` (есть что удалять за период). */
    onDeletePayout: (row: PayoutEmployeeRow) => void
    isResolvingDeletePayout: boolean
    className?: string
}

/**
 * Pencil `OKluo` (`Выплата · Месяц`, десктопная таблица, P3.1): чекбокс · Сотрудник ·
 * Начислено · Авансы · Ручные · Остаток, ₽ (минус — красным, ноль — серым) · Выплачено ·
 * Статус · Действия («Выплатить» — для всех строк, включая нулевые/отрицательные, +
 * «Открыть баланс»). Тот же приём столбцов, что `DepartmentBalancesTable`, плюс чекбокс/
 * действие «Выплатить» и колонка «Выплачено».
 */
function PayoutTable({
    rows,
    selectedIds,
    onToggleRow,
    onToggleAll,
    isAllSelected,
    isIndeterminate,
    onPay,
    onDeletePayout,
    isResolvingDeletePayout,
    className,
}: PayoutTableProps) {
    return (
        <div data-slot="payout-table" className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}>
            <div className="overflow-x-auto">
                <div className="min-w-[1080px]">
                    <div className="flex items-center border-b border-hairline bg-canvas">
                        <div className="flex h-10 w-11 shrink-0 items-center justify-center">
                            <Checkbox
                                checked={isIndeterminate ? 'indeterminate' : isAllSelected}
                                onCheckedChange={onToggleAll}
                                aria-label="Выбрать всех сотрудников"
                            />
                        </div>
                        <ColumnHeader label="Сотрудник" className="min-w-[220px] flex-1" />
                        <ColumnHeader label="Начислено" align="end" className={COLUMN_WIDTH.accrued} />
                        <ColumnHeader label="Авансы" align="end" className={COLUMN_WIDTH.advances} />
                        <ColumnHeader label="Ручные" align="end" className={COLUMN_WIDTH.manual} />
                        <ColumnHeader label="Остаток, ₽" align="end" emphasis className={COLUMN_WIDTH.balance} />
                        <ColumnHeader label="Выплачено" align="end" className={COLUMN_WIDTH.paid} />
                        <ColumnHeader label="Статус" className={COLUMN_WIDTH.status} />
                        <ColumnHeader label="" className={COLUMN_WIDTH.actions} />
                    </div>

                    {rows.length === 0 ? (
                        <p className="px-4 py-8 text-center font-ui text-xs text-ink-muted">
                            Под выбранный фильтр не попал ни один сотрудник.
                        </p>
                    ) : (
                        rows.map((row) => (
                            <PayoutTableRow
                                key={row.employeeId}
                                row={row}
                                selected={selectedIds.has(row.employeeId)}
                                onToggle={() => onToggleRow(row.employeeId)}
                                onPay={() => onPay(row)}
                                onDeletePayout={() => onDeletePayout(row)}
                                isResolvingDeletePayout={isResolvingDeletePayout}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}

function PayoutTableRow({
    row,
    selected,
    onToggle,
    onPay,
    onDeletePayout,
    isResolvingDeletePayout,
}: {
    row: PayoutEmployeeRow
    selected: boolean
    onToggle: () => void
    onPay: () => void
    onDeletePayout: () => void
    isResolvingDeletePayout: boolean
}) {
    const isPaid = row.payoutStatus === 'PAID'

    return (
        <div
            data-slot="payout-table-row"
            className="flex items-center border-b border-hairline transition-colors last:border-b-0 hover:bg-canvas"
        >
            <div className="flex w-11 shrink-0 items-center justify-center self-stretch">
                <Checkbox checked={selected} onCheckedChange={onToggle} disabled={isPaid} aria-label={`Выбрать сотрудника: ${row.name}`} />
            </div>

            <div className="flex min-w-[220px] flex-1 items-center gap-3 px-3 py-2.5">
                <Avatar>
                    <AvatarFallback>{employeeInitials(row.name)}</AvatarFallback>
                </Avatar>
                <span className="truncate font-ui text-sm font-semibold text-ink">{row.name}</span>
            </div>

            <span className={cn('shrink-0 px-3 text-right font-ui text-sm text-ink tabular-nums', COLUMN_WIDTH.accrued)}>
                {formatNumberOrDash(row.accrued)}
            </span>
            <span className={cn('shrink-0 px-3 text-right font-ui text-sm text-ink-muted tabular-nums', COLUMN_WIDTH.advances)}>
                {formatNumberOrDash(row.advances)}
            </span>
            <span
                className={cn(
                    'shrink-0 px-3 text-right font-ui text-sm font-semibold tabular-nums',
                    row.manual > 0 ? 'text-ok-ink' : row.manual < 0 ? 'text-danger' : 'text-ink-faint',
                    COLUMN_WIDTH.manual,
                )}
            >
                {row.manual === 0 ? '—' : formatSignedCurrency(row.manual)}
            </span>
            <span
                className={cn(
                    'shrink-0 px-3 text-right font-ui text-sm font-bold tabular-nums',
                    row.balance < 0 ? 'text-danger' : row.balance === 0 ? 'text-ink-faint' : 'text-ink',
                    COLUMN_WIDTH.balance,
                )}
            >
                {formatCurrency(row.balance)}
            </span>
            <span className={cn('shrink-0 px-3 text-right font-ui text-sm text-ink-muted tabular-nums', COLUMN_WIDTH.paid)}>
                {row.paid === 0 ? '—' : formatCurrency(Math.abs(row.paid))}
            </span>

            <div className={cn('shrink-0 px-3', COLUMN_WIDTH.status)}>
                <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 font-ui text-xs font-medium', STATUS_BADGE_TONE[row.payoutStatus])}>
                    {PAYOUT_STATUS_LABEL[row.payoutStatus]}
                </span>
            </div>

            <div className={cn('flex shrink-0 items-center justify-end gap-2 px-3 py-2', COLUMN_WIDTH.actions)}>
                <Button type="button" size="sm" variant={row.balance <= 0 ? 'secondary' : 'default'} onClick={onPay}>
                    <Banknote />
                    Выплатить
                </Button>
                <Button type="button" variant="secondary" size="sm" asChild>
                    <Link to={`/balance/employee/${row.employeeId}`}>
                        <Wallet />
                        Баланс
                    </Link>
                </Button>
                {row.paid !== 0 && (
                    <IconButton
                        type="button"
                        variant="danger"
                        aria-label={`Удалить выплату: ${row.name}`}
                        onClick={onDeletePayout}
                        disabled={isResolvingDeletePayout}
                    >
                        {isResolvingDeletePayout ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    </IconButton>
                )}
            </div>
        </div>
    )
}

function formatNumberOrDash(amount: number): string {
    return amount === 0 ? '—' : formatCurrency(amount).replace(' ₽', '')
}

export { PayoutTable }
