import { describe, expect, it } from 'vitest'

import { formatHours } from './formatHours.ts'

describe('formatHours', () => {
    it('renders whole hours without a fractional part', () => {
        expect(formatHours(8)).toBe('8')
        expect(formatHours(12)).toBe('12')
    })

    it('renders a half-hour with a comma, one digit', () => {
        expect(formatHours(7.5)).toBe('7,5')
    })
})
