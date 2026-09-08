import type { ReactNode } from 'react'

/**
 * Single shared shape for "a link-like nav item" across the whole header: the desktop Nav Bar
 * pills (`HeaderDesktop`), the Subnav tabs below them (`Subnav`), the mobile drawer's grouped
 * list (`NavDrawer`), and the app-level nav config that feeds all three (`app/navigation.tsx`'s
 * former `NavLeaf`). Before this type existed, each of those four places declared its own
 * near-identical `label`/`to`/`icon`/`end?`/`disabled?` type (`HeaderNavItem`, `SubnavTab`,
 * `NavDrawerItem`, `NavLeaf`) that had to be kept in sync by hand; using one type here means a
 * field added for one surface (e.g. `active`) is available everywhere without re-declaring it.
 *
 * Lives in `shared/ui-kit` (not `app`) because the three presentational components importing it
 * are themselves in `shared` and FSD forbids `shared` importing from `app` — `app/navigation.tsx`
 * imports this type instead, which is allowed (`app` may import any lower layer).
 */
export type NavItem = {
    /** Item/tab label, e.g. "Продажи", "План продаж". */
    label: string
    /** Route pattern — passed to `NavLink`'s `to` prop and to `shared/lib/nav.ts`'s `matchPath`-based utilities. */
    to: string
    /** Leading icon, typically a `lucide-react` icon element. Optional — a Subnav tab may omit it. */
    icon?: ReactNode
    /** Forwarded to `NavLink`'s `end` prop / `matchPath`'s `end` option for exact-match semantics. */
    end?: boolean
    /** Renders a non-interactive, muted placeholder instead of a link — for pages not shipped yet. */
    disabled?: boolean
    /** Called in addition to navigating — the mobile drawer uses this to close itself on tap. */
    onClick?: () => void
    /**
     * Whether this item is the current section/tab/page. Computed by the caller (`app/Header.tsx`,
     * via `shared/lib/nav.ts`'s `findMostSpecificNavMatch`/`app/navigation.tsx`'s
     * `isTopLevelNavItemActive`) and passed down as plain data, rather than derived from
     * `NavLink`'s own path-prefix matching — keeps `HeaderDesktop`/`Subnav`/`NavDrawer` presentational.
     */
    active?: boolean
}
