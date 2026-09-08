import type { SalaryAccrualLineStatus, SalaryAccrualStatus } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

import { ACCRUAL_LINE_STATUS_LABEL, ACCRUAL_STATUS_LABEL } from '../model/labels.ts'

/**
 * Pencil `cfNlL` (колонка «Статус» списка начислений): Черновик — серый, Частично
 * начислено — жёлтый (`warn-soft`/`warn-ink`), Ожидает выплаты — синий
 * (`info-soft`/`info-ink`), Выплачено — зелёный (`brand-soft`/`ok-ink`). Та же
 * геометрия бейджа, что у `CellStatus` (`ERP/Molecule/Cell Status`), но со своим
 * перечнем статусов — `CellStatus` жёстко типизирован под `SalesPlanStatus`.
 */
const STATUS_CLASS: Record<SalaryAccrualStatus, string> = {
    DRAFT: 'bg-hairline text-ink-muted',
    PARTIALLY_ACCRUED: 'bg-warn-soft text-warn-ink',
    ACCRUED: 'bg-info-soft text-info-ink',
    PAID: 'bg-brand-soft text-ok-ink',
}

export type AccrualStatusBadgeProps = {
    status: SalaryAccrualStatus
    className?: string
}

function AccrualStatusBadge({ status, className }: AccrualStatusBadgeProps) {
    return (
        <span
            data-slot="accrual-status-badge"
            data-status={status}
            className={cn(
                'inline-flex w-fit shrink-0 items-center rounded-md px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap',
                STATUS_CLASS[status],
                className,
            )}
        >
            {ACCRUAL_STATUS_LABEL[status]}
        </span>
    )
}

/** Статус СТРОКИ документа (Pencil `jb7fL`): Черновик — серый, Начислено/Выплачено — зелёный. */
const LINE_STATUS_CLASS: Record<SalaryAccrualLineStatus, string> = {
    DRAFT: 'bg-hairline text-ink-muted',
    ACCRUED: 'bg-brand-soft text-ok-ink',
    PAID: 'bg-brand-soft text-ok-ink',
}

export type AccrualLineStatusBadgeProps = {
    status: SalaryAccrualLineStatus
    className?: string
}

function AccrualLineStatusBadge({ status, className }: AccrualLineStatusBadgeProps) {
    return (
        <span
            data-slot="accrual-line-status-badge"
            data-status={status}
            className={cn(
                'inline-flex w-fit shrink-0 items-center rounded-md px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap',
                LINE_STATUS_CLASS[status],
                className,
            )}
        >
            {ACCRUAL_LINE_STATUS_LABEL[status]}
        </span>
    )
}

/** Красный бейдж «Уволен» (Pencil `cfNlL`, строка «Белов Роман») — документ фиксирует
 * `isDismissed` на момент закрытия месяца. */
function DismissedBadge({ className }: { className?: string }) {
    return (
        <span
            data-slot="dismissed-badge"
            className={cn(
                'inline-flex w-fit shrink-0 items-center rounded-md bg-danger-soft px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap text-danger',
                className,
            )}
        >
            Уволен
        </span>
    )
}

/** Жёлтый бейдж «Корректировка» (Pencil `DQ3tV`'s `eO5JW`, `warn-soft`/`warn-ink` — та же пара
 * токенов, что и у иконки комментария скорректированной строки в старой таблице) — рядом с чипом
 * роли в строке правила, когда `isLineAdjusted(line)` истинно. */
function AdjustmentBadge({ className }: { className?: string }) {
    return (
        <span
            data-slot="adjustment-badge"
            className={cn(
                'inline-flex w-fit shrink-0 items-center rounded-md bg-warn-soft px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap text-warn-ink',
                className,
            )}
        >
            Корректировка
        </span>
    )
}

export { AccrualStatusBadge, AccrualLineStatusBadge, DismissedBadge, AdjustmentBadge }
