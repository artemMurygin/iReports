import { describe, expect, it } from 'vitest'

import { buildMonthDays, buildScheduleGridTemplate, daysInMonthCount } from './scheduleDays.ts'

describe('daysInMonthCount', () => {
    it('returns 31 for August', () => {
        expect(daysInMonthCount('2026-08')).toBe(31)
    })

    it('returns 30 for a 30-day month', () => {
        expect(daysInMonthCount('2026-09')).toBe(30)
    })

    it('returns 28 for a non-leap February', () => {
        expect(daysInMonthCount('2026-02')).toBe(28)
    })

    it('returns 29 for a leap February', () => {
        expect(daysInMonthCount('2028-02')).toBe(29)
    })
})

describe('buildMonthDays', () => {
    it('builds one entry per calendar day with correct weekday/weekend flags', () => {
        // Август 2026: 1 августа — суббота.
        const days = buildMonthDays('2026-08', '2026-08-18')
        expect(days).toHaveLength(31)
        expect(days[0]).toEqual({ date: '2026-08-01', day: 1, weekdayShort: 'сб', isWeekend: true, isToday: false })
        expect(days[1]).toEqual({ date: '2026-08-02', day: 2, weekdayShort: 'вс', isWeekend: true, isToday: false })
        expect(days[2]).toEqual({ date: '2026-08-03', day: 3, weekdayShort: 'пн', isWeekend: false, isToday: false })
    })

    it('flags exactly the day matching todayIso as today', () => {
        const days = buildMonthDays('2026-08', '2026-08-18')
        const today = days.find((d) => d.isToday)
        expect(today?.date).toBe('2026-08-18')
        expect(days.filter((d) => d.isToday)).toHaveLength(1)
    })

    it('flags no day as today when todayIso is outside the month', () => {
        const days = buildMonthDays('2026-08', '2026-09-01')
        expect(days.some((d) => d.isToday)).toBe(false)
    })
})

describe('buildScheduleGridTemplate', () => {
    it('includes the employee/hours/vacation columns plus one 32px column per day', () => {
        expect(buildScheduleGridTemplate(31)).toBe('196px repeat(31, 32px) 88px minmax(96px, 1fr)')
        expect(buildScheduleGridTemplate(28)).toBe('196px repeat(28, 32px) 88px minmax(96px, 1fr)')
    })
})
