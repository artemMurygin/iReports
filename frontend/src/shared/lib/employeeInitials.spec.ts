import { describe, expect, it } from 'vitest'

import { getEmployeeInitials } from './employeeInitials.ts'

describe('getEmployeeInitials', () => {
    it('takes the first letter of the first two words', () => {
        expect(getEmployeeInitials('Артём Мурыгин')).toBe('АМ')
        expect(getEmployeeInitials('Мария Зайцева')).toBe('МЗ')
    })

    it('collapses repeated whitespace between words', () => {
        expect(getEmployeeInitials('  Дмитрий   Соколов ')).toBe('ДС')
    })

    it('uses the first two letters of a single-word name', () => {
        expect(getEmployeeInitials('Тест')).toBe('ТЕ')
    })

    it('falls back to a placeholder for an empty name', () => {
        expect(getEmployeeInitials('   ')).toBe('?')
    })
})
