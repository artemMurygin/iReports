import { useLocation } from 'react-router-dom'

import { findMostSpecificNavMatch } from '@/shared/lib/nav.ts'
import { Header as UiKitHeader } from '@/shared/ui-kit/organisms/Header'

import { ALL_LEAVES, DRAWER_SECTIONS, isTopLevelNavItemActive, SECTIONS, TOP_LEVEL_NAV_ITEMS } from './navigation.tsx'

export function Header() {
    const location = useLocation()

    // Pick the most specific match, not the first one in array order: with `end: false` (the
    // default), a shorter leaf like "Отчёт по зарплате" (`/salaries`) matches any nested path,
    // including "Правила начисления" (`/salaries/rules`) — comparing raw `find` order made the
    // mobile app-bar/drawer show the wrong title depending on which leaf happened to come first
    // in `SECTIONS`. `findMostSpecificNavMatch` compares `to.length` to pick the longest (most
    // specific) matching path regardless of declaration order.
    const activeLeaf = findMostSpecificNavMatch(ALL_LEAVES, location.pathname) ?? ALL_LEAVES[0]

    // Subnav: the current section's own pages as tabs (node `SHMkH`) — only when there's more
    // than one to switch between. Exactly one tab is marked `active`: the most specific match
    // among the section's own items (same `findMostSpecificNavMatch` used for `activeLeaf` above),
    // not each tab's own independent `NavLink` prefix match — otherwise e.g. "Отчёт по зарплате"
    // (`/salaries`, prefix match) and "Правила начисления" (`/salaries/rules`) would both light up
    // on `/salaries/rules`.
    const activeSection = SECTIONS.find((section) => section.label === activeLeaf.section)
    const activeSubnavTab = activeSection ? findMostSpecificNavMatch(activeSection.items, location.pathname) : null
    const subnavTabs =
        activeSection && activeSection.items.length > 1
            ? activeSection.items.map(({ label, to, end, disabled }) => ({
                  label,
                  to,
                  end,
                  disabled,
                  active: activeSubnavTab?.to === to,
              }))
            : undefined

    // Nav Bar pills: each pill is lit when the current path belongs to its *whole* section (any
    // of that section's child pages), not merely when it matches the single "primary" child page
    // the pill happens to link to — otherwise the pill goes dark the moment you navigate to a
    // sibling page in the same section (e.g. "Зарплата" on `/salary-accruals`, "Продажи" on
    // `/sales-plan`). Computed per render (depends on `location.pathname`), unlike the
    // pathname-independent `TOP_LEVEL_NAV_ITEMS` constant it's derived from.
    const navItems = TOP_LEVEL_NAV_ITEMS.map((item) => ({
        ...item,
        active: isTopLevelNavItemActive(item, location.pathname),
    }))

    // Mobile drawer: same "exactly one active item" mechanism as the desktop pills/tabs above,
    // rather than `NavDrawer`'s own independent `NavLink.isActive` per item (that used a plain
    // path-prefix match with no notion of "the other items", the same class of bug fixed for
    // `HeaderDesktop`/`Subnav`). The drawer lists every section's items flattened across the whole
    // app (not just the current section, unlike Subnav's tabs), so the *single* most specific
    // match across all of them is exactly `activeLeaf` computed above — an item is active only
    // when it's that same leaf (`to` is unique across `ALL_LEAVES`, so comparing it is enough).
    const drawerSections = DRAWER_SECTIONS.map((section) => ({
        ...section,
        items: section.items.map((item) => ({ ...item, active: item.to === activeLeaf.to })),
    }))

    return (
        <UiKitHeader
            navItems={navItems}
            subnavTabs={subnavTabs}
            drawerSections={drawerSections}
            mobile={{ section: activeLeaf.section, page: activeLeaf.label }}
        />
    )
}
