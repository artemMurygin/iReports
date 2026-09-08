import type { SalesPlanStatus } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `d3fSR` (`ERP/Molecule/Cell Status`) —
 * wraps a single `ERP/Atom/Badge` (`PGyPp`). The Plan Table shows two concrete overrides:
 * `W7ps4l` "Status Утверждён" (`brand-soft` fill `#E9FAF0`, `ok-ink` text `#0B7A3E`) and
 * `I612u` "Status Черновик" (`warn-soft` fill `#FEF4E3`, `warn-ink` text `#8A5A05`) — a 1:1
 * match for `SalesPlanStatus`'s `APPROVED`/`CREATED` values from `ireports-contracts`.
 */
const STATUS_CONFIG: Record<SalesPlanStatus, { label: string; className: string }> = {
    CREATED: { label: 'Черновик', className: 'bg-warn-soft text-warn-ink' },
    APPROVED: { label: 'Утверждён', className: 'bg-brand-soft text-ok-ink' },
}

export type CellStatusProps = {
    status: SalesPlanStatus
    className?: string
}

function CellStatus({ status, className }: CellStatusProps) {
    const config = STATUS_CONFIG[status]

    return (
        <span
            data-slot="cell-status"
            data-status={status}
            className={cn(
                'inline-flex w-fit shrink-0 items-center rounded-md px-2 py-[3px] font-ui text-[11px] font-semibold whitespace-nowrap',
                config.className,
                className,
            )}
        >
            {config.label}
        </span>
    )
}

export { CellStatus }
