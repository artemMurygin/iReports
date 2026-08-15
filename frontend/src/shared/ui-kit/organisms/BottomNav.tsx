import * as React from 'react'
import { NavLink } from 'react-router-dom'

import { cn } from '@/shared/lib/tw'

/**
 * Pencil: design/sallary-first-iteration.pen, node `XXiyY` (`ERP/Mobile/Bottom Nav`, 390x72,
 * `surface` fill, 1px hairline top border, padding [10,8,0,8]) -> 5x `PhHqc`
 * (`ERP/Mobile/Nav Item`, `fill_container` width, vertical, gap 4, centered: 20px icon +
 * 11px label). The active item (`Продажи` in the sampled instance) gets a `brand-strong`
 * icon and a bolder, plain-`ink` (not brand-colored) label; the rest stay
 * `ink-muted`/normal weight.
 *
 * A new **global** mobile-shell element, not specific to any one page — see `app/BottomNav.tsx`
 * for the real navigation data. `shared` cannot import `app` or know about routes/pages (see
 * frontend/CLAUDE.md's FSD boundaries), so this component only knows about generic
 * label/icon/route/active items handed to it.
 */
export type BottomNavItem = {
    /** Item label, e.g. "Продажи". */
    label: string
    /** Leading icon, typically a `lucide-react` icon element (rendered at 20px). */
    icon: React.ReactNode
    /** Route passed to `NavLink`. Omit for a non-routed action item (e.g. "Ещё" toggling a drawer) — `active`/`onClick` drive that case instead. */
    to?: string
    /** Forwarded to `NavLink`'s `end` prop for exact-match active state. */
    end?: boolean
    /** Active/highlighted state for non-routed items. Ignored when `to` is set — `NavLink` derives its own active state from the current route. */
    active?: boolean
    /** Called on click for non-routed items (e.g. toggling a drawer). Ignored when `to` is set. */
    onClick?: () => void
    /** Renders a non-interactive, muted placeholder instead of a link/button — for pages not shipped yet (matches `HeaderDesktop`/`NavDrawer`'s same-named prop). */
    disabled?: boolean
}

export type BottomNavProps = {
    items: BottomNavItem[]
    className?: string
}

const ITEM_CLASS =
    'flex flex-1 flex-col items-center justify-center gap-1 rounded-[10px] py-1 outline-none select-none focus-visible:ring-2 focus-visible:ring-brand/40'

function BottomNav({ items, className }: BottomNavProps) {
    return (
        <nav
            data-slot="bottom-nav"
            aria-label="Основная навигация"
            className={cn(
                'sticky bottom-0 z-40 flex w-full items-stretch gap-1 border-t border-hairline bg-surface px-2 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] font-ui',
                className,
            )}
        >
            {items.map((item) => (
                <BottomNavEntry key={item.label} {...item} />
            ))}
        </nav>
    )
}

function BottomNavEntry({ label, icon, to, end, active, onClick, disabled }: BottomNavItem) {
    if (disabled) {
        return (
            <span className={cn(ITEM_CLASS, 'cursor-not-allowed select-none')}>
                <span className="text-ink-faint [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:pointer-events-none">{icon}</span>
                <span className="text-[11px] text-ink-faint">{label}</span>
            </span>
        )
    }

    if (to) {
        return (
            <NavLink to={to} end={end} className={ITEM_CLASS}>
                {({ isActive }) => (
                    <>
                        <span
                            className={cn(
                                '[&_svg]:size-5 [&_svg]:shrink-0',
                                isActive ? 'text-brand-strong' : 'text-ink-muted',
                            )}
                        >
                            {icon}
                        </span>
                        <span className={cn('text-[11px]', isActive ? 'font-semibold text-ink' : 'font-normal text-ink-muted')}>
                            {label}
                        </span>
                    </>
                )}
            </NavLink>
        )
    }

    return (
        <button type="button" aria-pressed={active} onClick={onClick} className={ITEM_CLASS}>
            <span className={cn('[&_svg]:size-5 [&_svg]:shrink-0', active ? 'text-brand-strong' : 'text-ink-muted')}>
                {icon}
            </span>
            <span className={cn('text-[11px]', active ? 'font-semibold text-ink' : 'font-normal text-ink-muted')}>
                {label}
            </span>
        </button>
    )
}

export { BottomNav }
