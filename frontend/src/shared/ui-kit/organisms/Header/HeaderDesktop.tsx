import * as React from 'react'
import { ChevronDown, Wrench } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui-kit/atoms/Avatar'
import { BellBadge } from '@/shared/ui-kit/atoms/BellBadge'
import { Divider } from '@/shared/ui-kit/atoms/Divider'

import { Subnav } from './Subnav'
import type { NavItem } from './types'

/**
 * Pencil: design/sallary-first-iteration.pen, node `dRfe8` (`ERP/Organism/Topnav`, 1440x104,
 * white fill, 1px hairline bottom border) -> children `NoQNT` (Nav Bar, 56px) + `SHMkH` (Subnav,
 * 48px, see `Subnav.tsx`).
 *
 * `NoQNT` breakdown:
 * - `K56JT` Nav Left (gap 14): `VOWM0` Brand (30x30 `ink`-filled rounded-8 mark with a `brand`
 *   wrench icon + "iRepair" Montserrat 16/700 wordmark) + `T0p7tl` Divider + `e1eFSf` Sections
 *   (gap 2, each item `eM1Bp` "ERP/Topnav Item": rounded-8, gap 8, padding [8,12], 16px icon,
 *   14px/500 Roboto label; active item gets `brand-soft` background and `ok-ink` icon/text).
 *   Every item is a **plain, direct link** — there is no dropdown/menu anywhere on this node. The
 *   Pencil mockup shows a trailing `chevron-down` glyph on three of the four section instances
 *   (`d9ICsG`/`J11aeS`/`z2bzF`), but this build renders **no** chevron on any Nav Bar item instead:
 *   it would read as "this opens a menu" even though nothing does (see `navigation.tsx`'s
 *   `TOP_LEVEL_NAV_ITEMS` comment). The actual second level of navigation is the separate `SHMkH`
 *   Subnav row underneath (see `Subnav.tsx`), not a popover attached to these items.
 * - `X8G3zd` Nav Right (gap 10): `l5W7O9` Bell + `f4tNY` Divider + `WNVaX` User (rounded-8,
 *   gap 9, padding [3,6,3,4]: `Avatar` + name/role text block + `chevron-down` "more" icon).
 *
 * The bell and the user block are triggers only — clicking either just flips a local
 * open/closed visual state (`aria-expanded` + a `canvas` highlight); no dropdown menu content
 * is implemented here (out of scope per the rollout plan, a later phase).
 */
export type HeaderDesktopUser = {
    /** Full name, e.g. "Артём Мурыгин". */
    name: string
    /** Role/position label, e.g. "Руководитель". */
    role: string
    /** Avatar fallback initials, e.g. "АМ". */
    initials: string
    /** Optional avatar image; falls back to `initials` when absent or failing to load. */
    avatarSrc?: string
}

export type HeaderDesktopProps = {
    /** Nav Bar's main navigation links (Nav Left "Sections"). Not hardcoded — always supplied by the caller. */
    navItems: NavItem[]
    /** Subnav tabs rendered below the Nav Bar — forwarded as-is to `Subnav`. Omit (or pass an empty array) to skip the Subnav row entirely, for pages with no sub-navigation. */
    subnavTabs?: NavItem[]
    /** Omit while there's no real signed-in user data to show — hides the avatar/name/role trigger entirely rather than displaying a placeholder identity. */
    user?: HeaderDesktopUser
    /** Shows/hides the bell's unread-indicator dot. Defaults to `false`. */
    hasUnreadNotifications?: boolean
    /** Called (in addition to toggling the local visual state) when the bell trigger is clicked. */
    onBellClick?: () => void
    /** Called (in addition to toggling the local visual state) when the user block trigger is clicked. */
    onUserClick?: () => void
    className?: string
}

function HeaderDesktop({
    navItems,
    subnavTabs,
    user,
    hasUnreadNotifications = false,
    onBellClick,
    onUserClick,
    className,
}: HeaderDesktopProps) {
    const [notificationsOpen, setNotificationsOpen] = React.useState(false)
    const [userMenuOpen, setUserMenuOpen] = React.useState(false)

    return (
        <header
            data-slot="header-desktop"
            className={cn('flex w-full flex-col border-b border-hairline bg-surface font-ui', className)}
        >
            <div
                data-slot="nav-bar"
                className="flex h-14 w-full shrink-0 items-center justify-between gap-4 border-b border-hairline px-7"
            >
                <div className="flex min-w-0 items-center gap-3.5">
                    <div className="flex shrink-0 items-center gap-[9px]">
                        <div className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-ink">
                            <Wrench className="size-[17px] text-brand" />
                        </div>
                        <span className="font-display text-base font-bold tracking-[-0.2px] text-ink">iRepair</span>
                    </div>

                    <Divider />

                    <nav className="flex items-center gap-0.5">
                        {navItems.map(({ label, to, icon, end, disabled, active }) =>
                            disabled ? (
                                <span
                                    key={to}
                                    className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 font-ui text-sm whitespace-nowrap text-ink-faint select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-ink-faint [&_svg:not([class*='size-'])]:size-4"
                                >
                                    {icon}
                                    {label}
                                </span>
                            ) : (
                                <NavLink
                                    key={to}
                                    to={to}
                                    end={end}
                                    className={cn(
                                        "flex items-center gap-2 rounded-lg px-3 py-2 font-ui text-sm whitespace-nowrap text-ink transition-colors select-none hover:bg-canvas [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-ink-muted [&_svg:not([class*='size-'])]:size-4",
                                        active && 'bg-brand-soft text-ok-ink hover:bg-brand-soft [&_svg]:text-ok-ink',
                                    )}
                                >
                                    {icon}
                                    {label}
                                </NavLink>
                            ),
                        )}
                    </nav>
                </div>

                <div className="flex shrink-0 items-center gap-2.5">
                    <BellBadge
                        hasUnread={hasUnreadNotifications}
                        aria-expanded={notificationsOpen}
                        aria-label="Уведомления"
                        className={cn(notificationsOpen && 'bg-canvas')}
                        onClick={() => {
                            setNotificationsOpen((open) => !open)
                            onBellClick?.()
                        }}
                    />

                    {user ? (
                        <>
                            <Divider />

                            <button
                                type="button"
                                data-slot="header-user"
                                aria-expanded={userMenuOpen}
                                className={cn(
                                    'flex items-center gap-[9px] rounded-lg py-[3px] pr-[6px] pl-[4px] outline-none transition-colors select-none hover:bg-canvas focus-visible:ring-2 focus-visible:ring-brand/40',
                                    userMenuOpen && 'bg-canvas',
                                )}
                                onClick={() => {
                                    setUserMenuOpen((open) => !open)
                                    onUserClick?.()
                                }}
                            >
                                <Avatar>
                                    {user.avatarSrc ? <AvatarImage src={user.avatarSrc} alt={user.name} /> : null}
                                    <AvatarFallback>{user.initials}</AvatarFallback>
                                </Avatar>
                                <span className="flex flex-col items-start gap-px">
                                    <span className="text-[13px] font-medium text-ink">{user.name}</span>
                                    <span className="text-[11px] text-ink-muted">{user.role}</span>
                                </span>
                                <ChevronDown
                                    className={cn(
                                        'size-[15px] shrink-0 text-ink-muted transition-transform',
                                        userMenuOpen && 'rotate-180',
                                    )}
                                />
                            </button>
                        </>
                    ) : null}
                </div>
            </div>

            {subnavTabs && subnavTabs.length > 0 ? <Subnav tabs={subnavTabs} /> : null}
        </header>
    )
}

export { HeaderDesktop }
