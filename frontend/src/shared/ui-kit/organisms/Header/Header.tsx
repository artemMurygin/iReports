import * as React from 'react'

import { cn } from '@/shared/lib/tw'

import { HeaderDesktop, type HeaderDesktopUser, type HeaderNavItem } from './HeaderDesktop'
import { HeaderMobile, type HeaderMobileAction } from './HeaderMobile'
import { NavDrawer, type NavDrawerSection } from './NavDrawer'
import { Scrim } from './Scrim'
import type { SubnavTab } from './Subnav'

/**
 * Single public entry point for the header: renders `HeaderDesktop` on `md:` and up and
 * `HeaderMobile` below that via Tailwind responsive utilities (`hidden md:flex` /
 * `flex md:hidden`) — never a JS width check, so it switches purely on CSS and stays correct
 * across SSR/resize with no layout flash.
 *
 * Owns the single piece of shared state both mobile pieces need: whether the mobile menu/drawer
 * is open. The `HeaderMobile` hamburger toggles it; `NavDrawer` (Pencil node `UiFMw`) slides in
 * with the list of app sections, and `Scrim` renders the dimming backdrop (Pencil node `C19pWf`)
 * above the page behind it. Both close on backdrop click.
 *
 * `open`/`onOpenChange` make that state optionally **controlled** from outside (standard
 * React controlled/uncontrolled hybrid, falling back to an internal `useState` when omitted —
 * every existing caller that doesn't pass them keeps working unchanged) — for a future trigger
 * elsewhere in the shell that needs to open this same drawer instead of a second, desynced
 * instance. No current caller passes them; every caller today relies on the uncontrolled default.
 */
export type HeaderProps = {
    /** Desktop Nav Bar's main navigation links. Not hardcoded — always supplied by the caller. */
    navItems: HeaderNavItem[]
    /** Desktop Subnav tabs, forwarded to `HeaderDesktop`. Omit to skip the Subnav row. */
    subnavTabs?: SubnavTab[]
    /** Shared between the desktop user block, the mobile profile avatar, and the drawer footer. Omit while there's no real signed-in user data — hides all three rather than showing a placeholder identity. */
    user?: HeaderDesktopUser
    /** Mobile-only breadcrumb + action buttons (the desktop bar has no equivalent of these). */
    mobile: {
        /** Breadcrumb's small top line, e.g. "Продажи". Omit for a single-line crumb. */
        section?: string
        /** Breadcrumb's main line, e.g. "План продаж". */
        page: string
        /** Right-side action icon buttons (0-2 typical, per the design's `kXibe` node). */
        actions?: HeaderMobileAction[]
    }
    /** Grouped nav sections rendered in the mobile drawer (Pencil node `Z5IedD`). */
    drawerSections: NavDrawerSection[]
    /** Shows/hides the bell's unread-indicator dot on both breakpoints. Defaults to `false`. */
    hasUnreadNotifications?: boolean
    onBellClick?: () => void
    onUserClick?: () => void
    onLogout?: () => void
    /** Controls the mobile menu/drawer's open state from outside. Omit to let `Header` manage it internally (uncontrolled, the default for every existing caller). */
    open?: boolean
    /** Required alongside `open` to actually change it — `Header` calls this instead of an internal setter when controlled. */
    onOpenChange?: (open: boolean) => void
    className?: string
}

function Header({
    navItems,
    subnavTabs,
    user,
    mobile,
    drawerSections,
    hasUnreadNotifications = false,
    onBellClick,
    onUserClick,
    onLogout,
    open,
    onOpenChange,
    className,
}: HeaderProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
    const isControlled = open !== undefined
    const mobileMenuOpen = isControlled ? open : uncontrolledOpen
    const setMobileMenuOpen = (next: boolean) => {
        if (!isControlled) setUncontrolledOpen(next)
        onOpenChange?.(next)
    }
    const closeMobileMenu = () => setMobileMenuOpen(false)

    // Close the drawer on navigation, in addition to whatever onClick the caller supplied per item.
    const drawerSectionsWithClose = drawerSections.map((section) => ({
        ...section,
        items: section.items.map((item) => ({
            ...item,
            onClick: () => {
                item.onClick?.()
                closeMobileMenu()
            },
        })),
    }))

    return (
        <>
            <HeaderDesktop
                navItems={navItems}
                subnavTabs={subnavTabs}
                user={user}
                hasUnreadNotifications={hasUnreadNotifications}
                onBellClick={onBellClick}
                onUserClick={onUserClick}
                className={cn('sticky top-0 z-30 hidden md:flex', className)}
            />

            <HeaderMobile
                section={mobile.section}
                page={mobile.page}
                actions={mobile.actions}
                menuOpen={mobileMenuOpen}
                onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
                hasUnreadNotifications={hasUnreadNotifications}
                onBellClick={onBellClick}
                user={user}
                onUserClick={onUserClick}
                className={cn('sticky top-0 z-50 flex md:hidden', className)}
            />

            <Scrim open={mobileMenuOpen} onClose={closeMobileMenu} />

            <NavDrawer
                open={mobileMenuOpen}
                onClose={closeMobileMenu}
                sections={drawerSectionsWithClose}
                user={user}
                onLogout={onLogout}
            />
        </>
    )
}

export { Header }
