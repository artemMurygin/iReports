import { Ellipsis } from 'lucide-react'

import { BottomNav as UiKitBottomNav, type BottomNavItem } from '@/shared/ui-kit/organisms/BottomNav'

import { TOP_LEVEL_NAV_ITEMS } from './navigation.tsx'

export type BottomNavProps = {
    /** Whether the (shared, see `app/Header.tsx`) mobile drawer is open — drives "Ещё"'s highlighted state. */
    open: boolean
    /** Toggles the shared drawer open state; "Ещё" calls this instead of navigating. */
    onOpenChange: (open: boolean) => void
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `XRMZu` (instance of `XXiyY`,
 * `ERP/Mobile/Bottom Nav`) — a new **global** mobile-shell element (not specific to
 * `pages/SalesPlan`), so it lives in `app` (routes/nav data owner, per frontend/CLAUDE.md's
 * FSD boundaries) and wraps the generic `shared/ui-kit/organisms/BottomNav` the same way
 * `app/Header.tsx` wraps `shared/ui-kit/organisms/Header`.
 *
 * Reuses `TOP_LEVEL_NAV_ITEMS` — the exact same 4 section-level links the desktop Nav Bar
 * uses — for the first 4 slots (Продажи/Аналитика/Зарплата/График), keeping both navs' IA in
 * sync from a single source. The 5th slot, "Ещё" (`XXiyY`'s icon `ellipsis`), has no route:
 * it opens the same `NavDrawer` the header's hamburger opens, via the `open`/`onOpenChange`
 * pair lifted to `app/Layout.tsx` (see that file's comment for why).
 */
export function BottomNav({ open, onOpenChange }: BottomNavProps) {
    const items: BottomNavItem[] = [
        ...TOP_LEVEL_NAV_ITEMS.map(({ label, icon, to, end, disabled }) => ({ label, icon, to, end, disabled })),
        {
            label: 'Ещё',
            icon: <Ellipsis />,
            active: open,
            onClick: () => onOpenChange(!open),
        },
    ]

    return <UiKitBottomNav items={items} className="flex md:hidden" />
}
