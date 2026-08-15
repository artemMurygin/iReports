import { matchPath, useLocation } from 'react-router-dom'

import { Header as UiKitHeader } from '@/shared/ui-kit/organisms/Header'

import { ALL_LEAVES, DRAWER_SECTIONS, SECTIONS, TOP_LEVEL_NAV_ITEMS } from './navigation.tsx'

export type HeaderProps = {
    /** Controls the mobile drawer's open state from outside — see `app/Layout.tsx`, which shares this with `app/BottomNav.tsx` so its "Ещё" item opens the same drawer as the hamburger. Omit for the previous, fully self-contained behavior. */
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

export function Header({ open, onOpenChange }: HeaderProps = {}) {
    const location = useLocation()

    const activeLeaf =
        ALL_LEAVES.find((item) => matchPath({ path: item.to, end: item.end ?? false }, location.pathname)) ??
        ALL_LEAVES[0]

    // Subnav: the current section's own pages as tabs (node `SHMkH`) — only when there's more
    // than one to switch between.
    const activeSection = SECTIONS.find((section) => section.label === activeLeaf.section)
    const subnavTabs =
        activeSection && activeSection.items.length > 1
            ? activeSection.items.map(({ label, to, end, disabled }) => ({ label, to, end, disabled }))
            : undefined

    return (
        <UiKitHeader
            navItems={TOP_LEVEL_NAV_ITEMS}
            subnavTabs={subnavTabs}
            drawerSections={DRAWER_SECTIONS}
            mobile={{ section: activeLeaf.section, page: activeLeaf.label }}
            open={open}
            onOpenChange={onOpenChange}
        />
    )
}
