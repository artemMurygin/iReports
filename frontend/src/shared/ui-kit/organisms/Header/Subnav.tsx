import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

import { cn } from '@/shared/lib/tw'

import type { NavItem } from './types'

/**
 * Pencil: design/sallary-first-iteration.pen, node `SHMkH`
 * (`ERP/Organism/Topnav` -> `Subnav`, 48px tall, horizontal padding 28px,
 * `justifyContent: space_between`). Tabs live in `ih3bd` (gap 22) and each
 * instantiate `P87QAG` (`ERP/Topnav Tab`: gap 8, padding [14,4]).
 *
 * Active tab: 2px `brand-strong` bottom border, `ok-ink` icon, `ink` text at
 * medium weight (node `JqtTK`, "Tab План продаж"). Inactive tab: `ink-muted`
 * icon/text at normal weight (node `B4nfn`, "Tab Воронка продаж"). `SHMkH`
 * itself carries no border in the design — the hairline seen above it in the
 * full Topnav comes from the Nav Bar's own bottom border, not from Subnav.
 *
 * Slot component: the tab list is entirely prop-driven (no hardcoded labels)
 * so any page can wire up its own tabs. Active state is NOT derived by
 * `react-router-dom`'s `NavLink` (its per-tab `isActive` has no notion of
 * "the other tabs" — with prefix matching, e.g. `/salaries` and
 * `/salaries/rules` would both light up on `/salaries/rules`). Instead the
 * caller (`app/Header.tsx`) computes the single most specific match via
 * `findMostSpecificNavMatch` and passes it down as this `active` flag, same
 * approach as the nav links row in `HeaderDesktop`. Tabs share the header-wide `NavItem` type
 * (`./types.ts`) — `icon`/`end`/`disabled`/`active` all mean the same thing here as they do for
 * `HeaderDesktop`'s nav pills and `NavDrawer`'s drawer items.
 */
type SubnavProps = {
    /** Ordered list of tabs to render — not hardcoded, always supplied by the caller. */
    tabs: NavItem[]
    /** Optional right-aligned content (the design's `space_between` layout leaves room for this). */
    actions?: ReactNode
    className?: string
}

function Subnav({ tabs, actions, className }: SubnavProps) {
    return (
        <div
            data-slot="subnav"
            className={cn('flex h-12 w-full shrink-0 items-center justify-between gap-4 bg-surface px-7', className)}
        >
            <div className="flex items-center gap-[22px]">
                {tabs.map(({ label, to, icon, end, disabled, active }) =>
                    disabled ? (
                        <span
                            key={to}
                            className={cn(
                                'flex cursor-not-allowed items-center gap-2 border-b-2 border-transparent py-3.5 font-ui text-sm text-ink-faint select-none',
                                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px] [&_svg]:text-ink-faint",
                            )}
                        >
                            {icon}
                            {label}
                        </span>
                    ) : (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            // Explicit 'false' (not `undefined`) when inactive: `NavLink` falls back to its
                            // own `isActive` (path-prefix) match to fill in a default `aria-current="page"`
                            // whenever the prop it's given is `undefined` — passing `undefined` here would
                            // silently resurrect exactly the "two tabs active" bug this `active` prop fixes
                            // (e.g. "Отчёт по зарплате"'s own prefix match on `/salaries/rules`).
                            aria-current={active ? 'page' : 'false'}
                            className={cn(
                                'flex items-center gap-2 border-b-2 border-transparent py-3.5 font-ui text-sm text-ink-muted transition-colors select-none',
                                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px] [&_svg]:text-ink-muted",
                                active && 'border-brand-strong font-medium text-ink [&_svg]:text-ok-ink',
                            )}
                        >
                            {icon}
                            {label}
                        </NavLink>
                    ),
                )}
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
    )
}

export { Subnav }
