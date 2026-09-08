import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `VU8hp` (`ERP/Molecule/Column Header`) —
 * a single table-header cell: 12px label, horizontal padding 12, height 40. The reusable
 * component itself carries the `canvas` background and an (unused, `enabled: false`) sort
 * icon, but every instance inside the real `Header Row` (`XBPIW`) sits on the row's own
 * `canvas` fill instead — so this molecule stays background-less and is meant to be
 * composed inside a header row that supplies it (see `SalesPlanTable`'s header row).
 *
 * `emphasis` mirrors the one header cell the design bolds/darkens above the rest — `H
 * Факт, ₽` (`XHgcZ`, `fontWeight: 600`, `fill: #010306`) — while every other label stays
 * `ink-muted`/500 (`H План, ₽`, `H Прогноз`, `H Осталось`, `H Выполнение`, `H Статус`).
 * `H Категория` (`C5AzZi`) is always emphasized regardless of the prop, matching the design.
 */
export type ColumnHeaderProps = {
    label: string
    align?: 'start' | 'end'
    /** Bolds/darkens the label, e.g. the "Факт, ₽" column the design calls out as primary. */
    emphasis?: boolean
    className?: string
}

function ColumnHeader({ label, align = 'start', emphasis = false, className }: ColumnHeaderProps) {
    return (
        <div
            data-slot="column-header"
            className={cn('flex h-10 shrink-0 items-center px-3', align === 'end' && 'justify-end', className)}
        >
            <span
                className={cn(
                    'truncate font-ui text-xs',
                    emphasis ? 'font-semibold text-ink' : 'font-medium text-ink-muted',
                )}
            >
                {label}
            </span>
        </div>
    )
}

export { ColumnHeader }
