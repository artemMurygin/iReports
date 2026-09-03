import * as React from 'react'
import { ChevronRight, LogOut, Wrench, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui-kit/atoms/Avatar'

import type { NavItem } from './types'

/**
 * Pencil: design/sallary-first-iteration.pen, node `UiFMw` (`Drawer`, 320x844, white fill,
 * positioned at the same anchor as the `Scrim` (`C19pWf`) so it slides in above it) -> children
 * `xU58i` (Drawer Header) + `Z5IedD` (Nav) + `RlpRH` (Drawer Footer).
 *
 * This is the mobile navigation drawer opened by the hamburger button in `HeaderMobile`. It is
 * rendered by `Header.tsx` above `Scrim`, sharing the same `open`/`onClose` state.
 *
 * Items share the header-wide `NavItem` type (`./types.ts`). Active state works the same way as
 * `HeaderDesktop`'s nav pills and `Subnav`'s tabs: the caller (`app/Header.tsx`) computes each
 * item's `active` flag via `findMostSpecificNavMatch` (`shared/lib/nav.ts`) against the full leaf
 * list and passes it down, rather than this component deriving it from `NavLink`'s own
 * path-prefix matching.
 */
export type NavDrawerSection = {
    /** Section label, e.g. "Продажи". Omit for an ungrouped trailing section (matches node `R1skpA`). */
    label?: string
    /** Renders a hairline divider above this section instead of a label (matches node `FqZtX`). */
    divider?: boolean
    items: NavItem[]
}

export type NavDrawerUser = {
    name: string
    role: string
    initials: string
    avatarSrc?: string
}

export type NavDrawerProps = {
    /** Whether the drawer is open. Always mounted so it can slide in/out; hidden from a11y tree while closed. */
    open: boolean
    onClose: () => void
    sections: NavDrawerSection[]
    /** Omit while there's no real signed-in user data to show — hides the footer (avatar/name/role/logout) entirely rather than displaying a placeholder identity. */
    user?: NavDrawerUser
    onLogout?: () => void
    className?: string
}

function NavDrawer({ open, onClose, sections, user, onLogout, className }: NavDrawerProps) {
    const rootRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        if (open) return
        const active = document.activeElement
        if (active instanceof HTMLElement && rootRef.current?.contains(active)) {
            active.blur()
        }
    }, [open])

    return (
        <div
            ref={rootRef}
            data-slot="nav-drawer"
            aria-hidden={!open}
            className={cn(
                'fixed inset-y-0 left-0 z-[55] flex w-80 max-w-[85vw] flex-col bg-surface shadow-xl transition-transform duration-200 ease-out',
                open ? 'translate-x-0' : '-translate-x-full',
                className,
            )}
        >
            <div className="flex shrink-0 items-center gap-3 border-b border-hairline py-3.5 pr-3 pl-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-ink">
                    <Wrench className="size-5 text-brand" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-display text-[17px] font-bold text-ink">iRepair</span>
                    <span className="truncate text-[11px] text-ink-muted">ERP · Управление</span>
                </div>
                <button
                    type="button"
                    aria-label="Закрыть меню"
                    onClick={onClose}
                    className="flex size-9 shrink-0 items-center justify-center rounded-[6px] text-ink transition-colors outline-none select-none hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                    <X className="size-5" />
                </button>
            </div>

            <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2.5 pt-2 pb-3">
                {sections.map((section, sectionIndex) => (
                    <div key={section.label ?? sectionIndex} className="flex flex-col gap-1">
                        {section.divider ? (
                            <div className="px-2 py-2.5">
                                <div className="h-px w-full bg-hairline" />
                            </div>
                        ) : null}
                        {section.label ? (
                            <span className="px-2 pt-3 pb-1.5 text-[11px] font-semibold tracking-[0.4px] text-ink-muted first:pt-0">
                                {section.label}
                            </span>
                        ) : null}
                        {section.items.map(({ label, to, icon, end, onClick, disabled, active }) =>
                            disabled ? (
                                <span
                                    key={to}
                                    className="flex cursor-not-allowed items-center gap-2 rounded-[10px] px-2.5 py-[11px] text-[15px] text-ink-faint select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-ink-faint [&_svg:not([class*='size-'])]:size-5"
                                >
                                    {icon}
                                    <span className="truncate">{label}</span>
                                </span>
                            ) : (
                                <NavLink
                                    key={to}
                                    to={to}
                                    end={end}
                                    onClick={onClick}
                                    // Explicit 'false' (not `undefined`) when inactive: `NavLink` falls back to
                                    // its own `isActive` (path-prefix) match to fill in a default
                                    // `aria-current="page"` whenever the prop it's given is `undefined` —
                                    // same trap documented in `Subnav.tsx` for the same reason.
                                    aria-current={active ? 'page' : 'false'}
                                    className={cn(
                                        "flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-[11px] text-[15px] text-ink transition-colors select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
                                        active
                                            ? 'bg-brand-soft font-medium text-ok-ink [&_svg]:text-ok-ink'
                                            : 'hover:bg-canvas [&_svg]:text-ink-muted',
                                    )}
                                >
                                    <span className="flex min-w-0 items-center gap-2">
                                        {icon}
                                        <span className="truncate">{label}</span>
                                    </span>
                                    <ChevronRight
                                        className={cn('size-[18px] shrink-0', active ? 'text-ok-ink' : 'text-ink-faint')}
                                    />
                                </NavLink>
                            ),
                        )}
                    </div>
                ))}
            </nav>

            {user ? (
                <div className="flex shrink-0 items-center gap-3 border-t border-hairline py-3 pr-3 pl-4">
                    <Avatar size="lg">
                        {user.avatarSrc ? <AvatarImage src={user.avatarSrc} alt={user.name} /> : null}
                        <AvatarFallback>{user.initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-ink">{user.name}</span>
                        <span className="truncate text-[11px] text-ink-muted">{user.role}</span>
                    </div>
                    <button
                        type="button"
                        aria-label="Выйти"
                        onClick={onLogout}
                        className="flex size-9 shrink-0 items-center justify-center rounded-[6px] text-ink-muted transition-colors outline-none select-none hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand/40"
                    >
                        <LogOut className="size-[18px]" />
                    </button>
                </div>
            ) : null}
        </div>
    )
}

export { NavDrawer }
