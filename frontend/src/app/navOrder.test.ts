import { describe, expect, it } from 'vitest'

import { DRAWER_SECTIONS, TOP_LEVEL_NAV_ITEMS } from './navigation.tsx'

/**
 * Bug 3 (header-navigation-fixes PRD): the top-level nav order used to fall out of `SECTIONS`'s
 * literal array order (Продажи, Аналитика, Зарплата, Настройки) plus a separate concatenation of
 * `STANDALONE_ITEM` ("График работы") at the very end — an implementation detail of how
 * `TOP_LEVEL_NAV_ITEMS`/`DRAWER_SECTIONS` were assembled, not a declared order. The target order
 * is Продажи, Зарплата, График работы, Аналитика, Настройки; both the desktop pills and the
 * mobile drawer must show it, and must show the *same* order as each other.
 */
const EXPECTED_ORDER = ['Продажи', 'Зарплата', 'График работы', 'Аналитика', 'Настройки']

describe('top-level nav order', () => {
    it('lists TOP_LEVEL_NAV_ITEMS (desktop) in the target order', () => {
        expect(TOP_LEVEL_NAV_ITEMS.map((item) => item.label)).toEqual(EXPECTED_ORDER)
    })

    it('lists DRAWER_SECTIONS (mobile) in the same target order', () => {
        // Sections carry `label`; the trailing standalone "График работы" entry is an ungrouped,
        // divider-only section (`label` omitted, matches node `FqZtX`), so its label comes from
        // its single item instead.
        const labels = DRAWER_SECTIONS.map((section) => section.label ?? section.items[0]?.label)
        expect(labels).toEqual(EXPECTED_ORDER)
    })

    it('keeps desktop and mobile order identical to each other', () => {
        const drawerLabels = DRAWER_SECTIONS.map((section) => section.label ?? section.items[0]?.label)
        expect(TOP_LEVEL_NAV_ITEMS.map((item) => item.label)).toEqual(drawerLabels)
    })
})
