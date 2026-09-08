import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `w9BS6C` (`ERP/Molecule/Cell Progress`) —
 * a 150px `ERP/Atom/Progress` track + a percentage label, gap 10.
 *
 * Two sizes, matching the two progress bars stacked inside each Plan Table row
 * (`GxX7C/Metrics`): `default` is the 8px, colored revenue-line bar (14px/500 ink label,
 * e.g. `a7BxFW`/`oK3TN`); `compact` is the 5px, always-muted margin-line bar (12px/normal
 * muted label, e.g. `c7nWy`/`cArH8` — every "Margin Progress" instance found in the design
 * uses the same flat `#C9C9CC` fill regardless of its percentage, unlike the revenue bar).
 *
 * The revenue bar's fill color is threshold-based, read directly off the design's sampled
 * instances (`oK3TN` 73%, `bUhsY` 70%, `Mi7vr` 70%, `j4WTv` 87% -> `#7FCB4B`; `T6QLt` 102%
 * -> `brand-strong` `#22C46A`; `rMmHM` 55%, `km9aC` 53% -> `warn` `#F5A524`) extrapolated
 * down to a `danger` tier for values low enough that none of the design's sample rows hit it.
 */
export type CellProgressSize = 'default' | 'compact'

export type CellProgressProps = {
    /** Percent completion (0-100+); values are clamped for the bar's fill width but the label shows the real number. */
    percent: number
    size?: CellProgressSize
    className?: string
}

function progressToneClassName(percent: number) {
    if (percent >= 100) return 'bg-brand-strong'
    if (percent >= 70) return 'bg-[#7fcb4b]'
    if (percent >= 40) return 'bg-warn'
    return 'bg-danger'
}

function CellProgress({ percent, size = 'default', className }: CellProgressProps) {
    const filledWidth = Math.max(0, Math.min(100, percent))
    const compact = size === 'compact'

    return (
        <div data-slot="cell-progress" data-size={size} className={cn('flex min-w-0 items-center gap-2.5', className)}>
            <div
                className={cn(
                    'w-[150px] shrink-0 overflow-hidden rounded-full bg-hairline',
                    compact ? 'h-[5px]' : 'h-2',
                )}
            >
                <div
                    className={cn('h-full rounded-full', compact ? 'bg-[#c9c9cc]' : progressToneClassName(filledWidth))}
                    style={{ width: `${filledWidth}%` }}
                />
            </div>
            <span
                className={cn(
                    'shrink-0 font-ui tabular-nums',
                    compact ? 'text-xs text-ink-muted' : 'text-sm font-medium text-ink',
                )}
            >
                {Math.round(percent)}%
            </span>
        </div>
    )
}

export { CellProgress }
