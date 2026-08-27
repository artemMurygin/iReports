import { matchPath, useLocation } from 'react-router-dom'

import { Header as UiKitHeader } from '@/shared/ui-kit/organisms/Header'

import { ALL_LEAVES, DRAWER_SECTIONS, SECTIONS, TOP_LEVEL_NAV_ITEMS } from './navigation.tsx'

export function Header() {
    const location = useLocation()

    // Pick the most specific match, not the first one in array order: with `end: false` (the
    // default), a shorter leaf like "Отчёт по зарплате" (`/salaries`) matches any nested path,
    // including "Правила начисления" (`/salaries/rules`) — comparing raw `find` order made the
    // mobile app-bar/drawer show the wrong title depending on which leaf happened to come first
    // in `SECTIONS`. Comparing `to.length` picks the longest (most specific) matching path
    // regardless of declaration order.
    const activeLeaf =
        ALL_LEAVES.filter((item) => matchPath({ path: item.to, end: item.end ?? false }, location.pathname)).reduce<
            (typeof ALL_LEAVES)[number] | null
        >((best, item) => (best === null || item.to.length > best.to.length ? item : best), null) ?? ALL_LEAVES[0]

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
        />
    )
}
