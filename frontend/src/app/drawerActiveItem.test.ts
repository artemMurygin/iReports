import { describe, expect, it } from 'vitest'

import { findMostSpecificNavMatch } from '@/shared/lib/nav.ts'

import { ALL_LEAVES, DRAWER_SECTIONS } from './navigation.tsx'

/**
 * Phase 3 (header-navigation-fixes PRD): mirrors the exact computation `app/Header.tsx` performs
 * for `NavDrawer`'s per-item `active` flag — `findMostSpecificNavMatch` over the *whole* leaf list
 * (`ALL_LEAVES`, unlike `Subnav`'s per-section `activeSubnavTab`, since the drawer flattens every
 * section's items together) followed by comparing `to` against that single most-specific leaf —
 * against the real `DRAWER_SECTIONS` data, to lock in that every path across every section resolves
 * to exactly one active drawer item (never zero, never two), even when a sibling item's own `to`
 * still prefix-matches the route.
 */
function activeDrawerItemLabels(pathname: string): string[] {
    const activeLeaf = findMostSpecificNavMatch(ALL_LEAVES, pathname) ?? ALL_LEAVES[0]
    return DRAWER_SECTIONS.flatMap((section) => section.items)
        .filter((item) => item.to === activeLeaf.to)
        .map((item) => item.label)
}

describe('NavDrawer active item resolution', () => {
    it.each([
        ['/', 'Воронка продаж'],
        ['/sales-plan', 'План продаж'],
        ['/services', 'Услуги'],
        ['/salaries', 'Отчёт по зарплате'],
        ['/salaries/rules', 'Правила начисления'],
        ['/salary-accruals', 'Начисления'],
        ['/balance', 'Взаиморасчёты'],
        ['/settings/employee-identity', 'Связи сотрудников'],
        ['/work-schedule', 'График работы'],
    ])('activates exactly "%s" -> %s and nothing else', (pathname, expectedLabel) => {
        expect(activeDrawerItemLabels(pathname)).toEqual([expectedLabel])
    })

    it.each(['/salaries/rules/new', '/salary-accruals/123', '/balance/employee/9'])(
        'resolves exactly one active item on %s, even though a sibling item still prefix-matches',
        (pathname) => {
            expect(activeDrawerItemLabels(pathname)).toHaveLength(1)
        },
    )
})
