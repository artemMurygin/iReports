import { describe, expect, it } from 'vitest'

import { buildWeekDays } from './weekDays.ts'

describe('buildWeekDays', () => {
    it('builds Monday-Sunday of the week containing todayIso', () => {
        // 18 августа 2026 — вторник (см. scheduleDays.spec.ts, тот же опорный факт).
        const days = buildWeekDays('2026-08-18')
        expect(days).toHaveLength(7)
        expect(days.map((d) => d.date)).toEqual([
            '2026-08-17',
            '2026-08-18',
            '2026-08-19',
            '2026-08-20',
            '2026-08-21',
            '2026-08-22',
            '2026-08-23',
        ])
        expect(days.map((d) => d.weekdayShort)).toEqual(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'])
    })

    it('flags Saturday/Sunday as weekend and nothing else', () => {
        const days = buildWeekDays('2026-08-18')
        expect(days.map((d) => d.isWeekend)).toEqual([false, false, false, false, false, true, true])
    })

    it('flags exactly the day matching todayIso as today', () => {
        const days = buildWeekDays('2026-08-18')
        expect(days.filter((d) => d.isToday)).toHaveLength(1)
        expect(days.find((d) => d.isToday)?.date).toBe('2026-08-18')
    })

    it('builds the correct week when todayIso itself is a Sunday', () => {
        // 23 августа 2026 — воскресенье той же недели.
        const days = buildWeekDays('2026-08-23')
        expect(days[0].date).toBe('2026-08-17')
        expect(days[6].date).toBe('2026-08-23')
        expect(days[6].isToday).toBe(true)
    })

    it('crosses a month boundary correctly', () => {
        // 1 сентября 2026 — вторник; неделя начинается 31 августа.
        const days = buildWeekDays('2026-09-01')
        expect(days.map((d) => d.date)).toEqual([
            '2026-08-31',
            '2026-09-01',
            '2026-09-02',
            '2026-09-03',
            '2026-09-04',
            '2026-09-05',
            '2026-09-06',
        ])
    })
})
