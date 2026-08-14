import * as React from 'react'
import { Menu } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui-kit/atoms/Avatar'
import { BellBadge } from '@/shared/ui-kit/atoms/BellBadge'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'

/**
 * Pencil: design/sallary-first-iteration.pen, reusable component `kXibe` (`ERP/Mobile/App Bar`,
 * 390x52, white fill, 1px hairline bottom border, padding [0,12], gap 10, `space_between`).
 *
 * `kXibe` breakdown:
 * - `pkMDC` Left (gap 10, center): `JqYQG` Menu — `ERP/Atom/Icon Button` instance, `lg` (32x32),
 *   `menu` icon 18x18 — + `igfAP` Crumb (vertical, gap 1): `B5hqq` Section (11px/500 `ink-muted`,
 *   e.g. "Продажи") + `N20kjU` Page (14px/600 `ink`, e.g. "План продаж"). Other real instances of
 *   this component (`bzk8c`, "App Bar · Уведомления") disable the Section line for single-line
 *   crumbs — so `section` is optional here and the line is omitted entirely when absent, same as
 *   that override does with `enabled: false`.
 * - `KMFKi` Right (gap 6, center): action `IconButton`s (`lg`, e.g. `tbU0H` search 17x17 —
 *   `oTq9M` ellipsis-vertical is present in the component but `enabled: false` in every real
 *   instance in the file, i.e. this App Bar typically ships with a single visible action; the
 *   slot supports 0-2 so a caller can opt into a second one) + `YVWZc` `BellBadge` + `WBewi`
 *   Profile `Avatar` (30x30 in the design; rendered here at the atom's default 32x32 — same
 *   4px rounding already accepted for `BellBadge` in `HeaderDesktop`, see that file's report).
 *
 * All business content (breadcrumb text, action icons/handlers, bell/user state) is passed in as
 * props — nothing is hardcoded, mirroring `HeaderDesktop`'s "slots, not hardcoded content" rule.
 */
export type HeaderMobileAction = {
    /** Icon element, typically a `lucide-react` icon (rendered at 17px unless it carries its own `size-*` class). */
    icon: React.ReactNode
    /** Accessible label — there's no visible text on a mobile action button. */
    label: string
    onClick?: () => void
    disabled?: boolean
}

export type HeaderMobileUser = {
    /** Avatar fallback initials, e.g. "АМ". */
    initials: string
    /** Full name, used only for `alt`/`aria-label` text — not rendered on the mobile bar. */
    name?: string
    /** Optional avatar image; falls back to `initials` when absent or failing to load. */
    avatarSrc?: string
}

export type HeaderMobileProps = {
    /** Breadcrumb's small top line, e.g. "Продажи". Omit to render a single-line crumb (matches `bzk8c`'s override). */
    section?: string
    /** Breadcrumb's main line, e.g. "План продаж". */
    page: string
    /** Whether the mobile menu/drawer this bar controls is currently open. Reflected on the Menu button as `active` + `aria-expanded`. */
    menuOpen: boolean
    /** Called when the hamburger (Menu) button is clicked — the caller owns the open/close state. */
    onMenuToggle: () => void
    /** Right-side action icon buttons (0-2 typical, per the design). Not hardcoded — always supplied by the caller. */
    actions?: HeaderMobileAction[]
    /** Shows/hides the bell's unread-indicator dot. Defaults to `false`. */
    hasUnreadNotifications?: boolean
    onBellClick?: () => void
    /** Omit while there's no real signed-in user data to show — hides the avatar trigger entirely rather than displaying a placeholder identity. */
    user?: HeaderMobileUser
    onUserClick?: () => void
    className?: string
}

function HeaderMobile({
    section,
    page,
    menuOpen,
    onMenuToggle,
    actions = [],
    hasUnreadNotifications = false,
    onBellClick,
    user,
    onUserClick,
    className,
}: HeaderMobileProps) {
    return (
        <header
            data-slot="header-mobile"
            className={cn(
                'flex h-[52px] w-full shrink-0 items-center justify-between gap-2.5 border-b border-hairline bg-surface px-3 font-ui',
                className,
            )}
        >
            <div className="flex min-w-0 items-center gap-2.5">
                <IconButton
                    size="lg"
                    active={menuOpen}
                    aria-expanded={menuOpen}
                    aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'}
                    onClick={onMenuToggle}
                >
                    <Menu className="size-[18px]" />
                </IconButton>

                <div className="flex min-w-0 flex-col items-start gap-px">
                    {section ? (
                        <span className="w-full truncate text-[11px] font-medium text-ink-muted">{section}</span>
                    ) : null}
                    <span className="w-full truncate text-sm font-semibold text-ink">{page}</span>
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
                {actions.map(({ icon, label, onClick, disabled }, index) => (
                    <IconButton
                        key={index}
                        size="lg"
                        aria-label={label}
                        disabled={disabled}
                        onClick={onClick}
                    >
                        {icon}
                    </IconButton>
                ))}

                <BellBadge
                    hasUnread={hasUnreadNotifications}
                    aria-label="Уведомления"
                    onClick={onBellClick}
                />

                {user ? (
                    <button
                        type="button"
                        data-slot="header-mobile-profile"
                        aria-label={user.name ?? 'Профиль'}
                        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                        onClick={onUserClick}
                    >
                        <Avatar>
                            {user.avatarSrc ? <AvatarImage src={user.avatarSrc} alt={user.name ?? ''} /> : null}
                            <AvatarFallback>{user.initials}</AvatarFallback>
                        </Avatar>
                    </button>
                ) : null}
            </div>
        </header>
    )
}

export { HeaderMobile }
