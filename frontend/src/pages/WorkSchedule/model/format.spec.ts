import { describe, expect, it } from 'vitest'

import { formatDayEditorDateLabel, formatFullDateLabel, formatMonthLabel, isValidMonth, shiftMonth } from './format.ts'

describe('formatMonthLabel', () => {
    it('formats a valid month in nominative case', () => {
        expect(formatMonthLabel('2026-08')).toBe('август 2026')
        expect(formatMonthLabel('2026-01')).toBe('январь 2026')
    })

    it('falls back to the raw string for an invalid month', () => {
        expect(formatMonthLabel('not-a-month')).toBe('not-a-month')
    })
})

describe('formatFullDateLabel', () => {
    it('formats a calendar date with genitive month', () => {
        expect(formatFullDateLabel('2026-08-18')).toBe('18 августа 2026')
        expect(formatFullDateLabel('2026-01-01')).toBe('1 января 2026')
    })

    it('falls back to the raw string for an invalid date', () => {
        expect(formatFullDateLabel('nope')).toBe('nope')
    })
})

describe('formatDayEditorDateLabel', () => {
    it('formats a calendar date with genitive month and full weekday name (design node Cko6w)', () => {
        // 2026-08-20 — четверг (та же дата, что и в мокапе Day Editor из design-Cko6w-calendar.html).
        expect(formatDayEditorDateLabel('2026-08-20')).toBe('20 августа, четверг')
    })

    it('resolves a different weekday for a different date', () => {
        expect(formatDayEditorDateLabel('2026-08-01')).toBe('1 августа, суббота')
    })

    it('falls back to the raw string for an invalid date', () => {
        expect(formatDayEditorDateLabel('nope')).toBe('nope')
    })
})

describe('isValidMonth', () => {
    it('accepts YYYY-MM', () => {
        expect(isValidMonth('2026-08')).toBe(true)
        expect(isValidMonth('2026-12')).toBe(true)
    })

    it('rejects out-of-range months and malformed strings', () => {
        expect(isValidMonth('2026-13')).toBe(false)
        expect(isValidMonth('2026-00')).toBe(false)
        expect(isValidMonth('2026-8')).toBe(false)
        expect(isValidMonth('2026/08')).toBe(false)
    })
})

describe('shiftMonth', () => {
    it('shifts forward within the same year', () => {
        expect(shiftMonth('2026-06', 1)).toBe('2026-07')
    })

    it('shifts backward within the same year', () => {
        expect(shiftMonth('2026-06', -1)).toBe('2026-05')
    })

    it('carries the year forward across December', () => {
        expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    })

    it('carries the year backward across January', () => {
        expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    })
})
