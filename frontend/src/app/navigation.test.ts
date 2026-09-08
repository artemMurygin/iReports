import { describe, expect, it } from 'vitest'

import { isTopLevelNavItemActive, TOP_LEVEL_NAV_ITEMS } from './navigation.tsx'

/**
 * Bug 1 (header-navigation-fixes PRD): the top-level "Зарплата"/"Продажи" nav pills used to be
 * matched against a single "primary" child page's `to` (`/salaries` for "Зарплата", `/` for
 * "Продажи"), so they went dark on any other page in the same section (`/salary-accruals`,
 * `/balance`, `/sales-plan`). `isTopLevelNavItemActive` fixes this by matching the *whole*
 * section's child pages (`TopLevelNavItem.matchPaths`), not just the pill's own link target.
 */
function isSectionActive(label: string, pathname: string): boolean {
    const item = TOP_LEVEL_NAV_ITEMS.find((navItem) => navItem.label === label)
    if (!item) throw new Error(`no such top-level nav item: "${label}"`)
    return isTopLevelNavItemActive(item, pathname)
}

describe('isTopLevelNavItemActive', () => {
    it.each([
        '/salaries',
        '/salaries/rules',
        '/salaries/rules/new',
        '/salary-accruals',
        '/salary-accruals/abc',
        '/balance',
        '/balance/employee/1',
    ])('marks "Зарплата" active on %s', (pathname) => {
        expect(isSectionActive('Зарплата', pathname)).toBe(true)
    })

    it.each(['/', '/sales-plan'])('marks "Продажи" active on %s', (pathname) => {
        expect(isSectionActive('Продажи', pathname)).toBe(true)
    })

    it('does not cross-activate "Продажи" on a "Зарплата" path', () => {
        expect(isSectionActive('Продажи', '/salaries')).toBe(false)
        expect(isSectionActive('Продажи', '/balance')).toBe(false)
    })

    it('does not cross-activate "Зарплата" on a "Продажи" path', () => {
        expect(isSectionActive('Зарплата', '/')).toBe(false)
        expect(isSectionActive('Зарплата', '/sales-plan')).toBe(false)
    })

    it('does not activate any section on an unrelated path', () => {
        expect(isSectionActive('Зарплата', '/services')).toBe(false)
        expect(isSectionActive('Продажи', '/services')).toBe(false)
    })
})
