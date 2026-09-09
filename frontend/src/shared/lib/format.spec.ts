import { describe, expect, it } from 'vitest'

import { formatRatio, formatShortDate, formatShortDateTime } from './format.ts'

describe('formatShortDate', () => {
    it('formats a Date without trailing periods (unlike Intl.DateTimeFormat)', () => {
        expect(formatShortDate(new Date(2026, 7, 21))).toBe('21 авг 2026')
    })

    it('accepts an ISO string the same way', () => {
        expect(formatShortDate('2026-08-21T10:00:00.000Z')).toBe(formatShortDate(new Date('2026-08-21T10:00:00.000Z')))
    })

    it('returns an em dash for null (no movement/timestamp yet)', () => {
        expect(formatShortDate(null)).toBe('—')
    })
})

describe('formatShortDateTime', () => {
    it('appends zero-padded HH:mm after the short date', () => {
        expect(formatShortDateTime(new Date(2026, 7, 25, 14, 30))).toBe('25 авг 2026, 14:30')
        expect(formatShortDateTime(new Date(2026, 0, 5, 9, 5))).toBe('5 янв 2026, 09:05')
    })

    it('accepts a numeric timestamp (dataUpdatedAt shape)', () => {
        const date = new Date(2026, 7, 25, 14, 30)
        expect(formatShortDateTime(date.getTime())).toBe(formatShortDateTime(date))
    })
})

describe('formatRatio', () => {
    it('formats two decimal places with a Russian comma, used by GoodsTurnoverTable turnoverRatio', () => {
        expect(formatRatio(0.891)).toBe('0,89')
        expect(formatRatio(1.2)).toBe('1,20')
        expect(formatRatio(0)).toBe('0,00')
    })
})
