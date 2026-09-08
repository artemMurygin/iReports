import { describe, expect, it } from 'vitest'

import { findMostSpecificNavMatch, matchesAnyNavPath, matchesNavPath } from './nav.ts'

describe('matchesNavPath', () => {
    it('matches a prefix path when `end` is omitted (default false)', () => {
        expect(matchesNavPath({ to: '/salaries' }, '/salaries/rules')).toBe(true)
    })

    it('only matches the exact path when `end` is true', () => {
        expect(matchesNavPath({ to: '/', end: true }, '/sales-plan')).toBe(false)
        expect(matchesNavPath({ to: '/', end: true }, '/')).toBe(true)
    })
})

describe('matchesAnyNavPath', () => {
    const salaryPatterns = [
        { to: '/salaries' },
        { to: '/salary-accruals' },
        { to: '/balance' },
        { to: '/salaries/rules' },
    ]

    it('matches when any pattern in the list matches, not just the first one', () => {
        expect(matchesAnyNavPath(salaryPatterns, '/balance/employee/1')).toBe(true)
    })

    it('returns false when nothing in the list matches', () => {
        expect(matchesAnyNavPath(salaryPatterns, '/services')).toBe(false)
    })
})

describe('findMostSpecificNavMatch', () => {
    const items = [
        { to: '/salaries', label: 'Отчёт по зарплате' },
        { to: '/salaries/rules', label: 'Правила начисления' },
    ]

    it('picks the longest matching path, not the first one in array order', () => {
        expect(findMostSpecificNavMatch(items, '/salaries/rules/new')?.label).toBe('Правила начисления')
    })

    it('still matches the shorter path when the longer one is not relevant', () => {
        expect(findMostSpecificNavMatch(items, '/salaries')?.label).toBe('Отчёт по зарплате')
    })

    it('returns null when nothing matches', () => {
        expect(findMostSpecificNavMatch(items, '/services')).toBeNull()
    })

    it('order in the array does not affect which match wins', () => {
        const reversed = [...items].reverse()
        expect(findMostSpecificNavMatch(reversed, '/salaries/rules/new')?.label).toBe('Правила начисления')
    })
})
