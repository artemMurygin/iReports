import * as React from 'react'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `dvsSJ` (`ERP/Molecule/KPI Card`) —
 * white 12px-rounded card, 1px inner border, 18px padding, vertical gap 10. `Head` row
 * (13px muted label + 16px icon, space-between) -> `Value` (Montserrat 24/700) -> `Note`
 * (12px).
 *
 * `tone` mirrors the two variant overrides seen on the desktop KPI Row (`iCsFr`): the
 * "Выручка · факт" card (`z1zWQw`) gets a `brand-border` outline and an `ok-ink` note —
 * `positive`; the "Выручка · прогноз" card (`c1bWB`) keeps the default hairline border but
 * colors its note `warn-ink` when the forecast falls short of the plan — `warning`. The
 * remaining three cards (Выручка·план, Маржа·план, Маржа·факт) are `default`.
 *
 * The icon is passed as `children`-like `icon` prop (same convention as `Button`/
 * `IconButton`) and defaults to `ink-muted` via inherited `currentColor` — pass an icon
 * with its own explicit color class (e.g. `<TrendingUp className="text-brand-strong" />`)
 * to override it per-instance, matching the "Выручка · факт" card's green `trending-up`.
 *
 * Also doubles as the mobile `TeVSB` (`ERP/Mobile/KPI Card`) instance used by `KpiGridMobile`
 * — same structure, slightly smaller below `md:` (14px padding, 18px value vs. desktop's 18px/
 * 24px, per `KpiGridMobile`'s comment). This isn't just cosmetic: at the 2-up mobile grid's
 * ~172px card width, real (non-mock) currency values reliably overflowed the 24px value at
 * 18px padding and got ellipsis-truncated — sizing down under `md:` (rather than introducing a
 * second component) fixes that and matches the design's own smaller mobile value size.
 */
export type KpiCardTone = 'default' | 'positive' | 'warning'

const TONE_BORDER: Record<KpiCardTone, string> = {
    default: 'border-hairline',
    positive: 'border-brand-border',
    warning: 'border-hairline',
}

const TONE_NOTE: Record<KpiCardTone, string> = {
    default: 'text-ink-muted',
    positive: 'text-ok-ink',
    warning: 'text-warn-ink',
}

export type KpiCardProps = {
    label: string
    value: string
    note: string
    icon: React.ReactNode
    tone?: KpiCardTone
    className?: string
}

function KpiCard({ label, value, note, icon, tone = 'default', className }: KpiCardProps) {
    return (
        <div
            data-slot="kpi-card"
            data-tone={tone}
            className={cn(
                'flex min-w-0 flex-1 flex-col gap-2 rounded-xl border bg-surface p-3.5 md:gap-2.5 md:p-[18px]',
                TONE_BORDER[tone],
                className,
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="truncate font-ui text-xs text-ink-muted md:text-[13px]">{label}</span>
                <span className="shrink-0 text-ink-muted [&_svg]:size-4 [&_svg]:shrink-0">{icon}</span>
            </div>
            <span className="truncate font-display text-lg font-bold tracking-[-0.3px] text-ink md:text-2xl md:tracking-[-0.5px]">
                {value}
            </span>
            <span className={cn('truncate font-ui text-xs', TONE_NOTE[tone])}>{note}</span>
        </div>
    )
}

export { KpiCard }
