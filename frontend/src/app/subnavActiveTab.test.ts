import { describe, expect, it } from 'vitest'

import { findMostSpecificNavMatch } from '@/shared/lib/nav.ts'

import { SECTIONS } from './navigation.tsx'

/**
 * Bug 2 (header-navigation-fixes PRD): mirrors the exact computation `app/Header.tsx` performs
 * for `Subnav`'s `active` tab — `findMostSpecificNavMatch` over the current section's own items —
 * against the real "Зарплата" section data, to lock in that every path in the section resolves to
 * exactly one active tab (never zero, never two).
 */
function requireSalarySection() {
    const section = SECTIONS.find((s) => s.label === 'Зарплата')
    if (!section) throw new Error('no "Зарплата" section in SECTIONS')
    return section
}
const salarySection = requireSalarySection()

function activeTabLabel(pathname: string): string | null {
    return findMostSpecificNavMatch(salarySection.items, pathname)?.label ?? null
}

describe('Subnav active tab resolution for "Зарплата"', () => {
    it('activates exactly "Отчёт по зарплате" on /salaries', () => {
        expect(activeTabLabel('/salaries')).toBe('Отчёт по зарплате')
    })

    it('activates exactly "Правила начисления" on /salaries/rules, not "Отчёт по зарплате"', () => {
        expect(activeTabLabel('/salaries/rules')).toBe('Правила начисления')
    })

    it('activates exactly "Начисления" on /salary-accruals', () => {
        expect(activeTabLabel('/salary-accruals')).toBe('Начисления')
    })

    it('activates exactly "Взаиморасчёты" on /balance', () => {
        expect(activeTabLabel('/balance')).toBe('Взаиморасчёты')
    })

    it.each(['/salaries', '/salaries/rules', '/salaries/rules/new', '/salary-accruals', '/balance'])(
        'resolves exactly one active tab on %s, even though several items prefix-match',
        (pathname) => {
            // Multiple items are allowed to independently prefix-match `pathname` (that's the whole
            // premise of the bug — e.g. both "Отчёт по зарплате" (`/salaries`) and "Правила
            // начисления" (`/salaries/rules`) match `/salaries/rules/new`) — what matters is
            // `findMostSpecificNavMatch` still collapses that down to a single result.
            expect(activeTabLabel(pathname)).not.toBeNull()
        },
    )
})
