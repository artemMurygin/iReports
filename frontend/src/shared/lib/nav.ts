import { matchPath } from 'react-router-dom'

/**
 * Generic shape shared by every "route pattern" this module works with — a header nav item, a
 * Subnav tab, a drawer item. Deliberately just `to`/`end`, no label/icon/business fields, so it
 * stays reusable infrastructure (no domain knowledge of sections/pages) rather than something
 * coupled to `app/navigation.tsx`'s concrete nav config.
 */
export type NavPathPattern = {
    /** Route pattern, passed to `react-router-dom`'s `matchPath` as `path`. */
    to: string
    /** Forwarded to `matchPath`'s `end` option. Defaults to `false` (prefix match), matching `NavLink`'s own default. */
    end?: boolean
}

/** Whether `pathname` matches this single pattern (same semantics `NavLink` uses internally). */
export function matchesNavPath(pattern: NavPathPattern, pathname: string): boolean {
    return matchPath({ path: pattern.to, end: pattern.end ?? false }, pathname) !== null
}

/** Whether `pathname` matches ANY of `patterns` — e.g. a whole section's pages, not just one of them. */
export function matchesAnyNavPath(patterns: readonly NavPathPattern[], pathname: string): boolean {
    return patterns.some((pattern) => matchesNavPath(pattern, pathname))
}

/**
 * Picks the most specific match for `pathname` among `items` — the one whose `to` is the
 * longest matching path, not simply the first match in array order.
 *
 * Necessary because with `end: false` (the default) a shorter path like `/salaries` matches
 * every nested path under it, including a more specific sibling like `/salaries/rules` —
 * comparing raw declaration/`find` order would pick whichever one happens to come first in the
 * array, not the one that actually best describes the current route. Comparing `to.length`
 * instead picks the longest (most specific) matching path regardless of declaration order.
 *
 * Returns `null` when nothing in `items` matches.
 */
export function findMostSpecificNavMatch<T extends NavPathPattern>(items: readonly T[], pathname: string): T | null {
    return items
        .filter((item) => matchesNavPath(item, pathname))
        .reduce<T | null>((best, item) => (best === null || item.to.length > best.to.length ? item : best), null)
}
