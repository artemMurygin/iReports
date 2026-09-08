import { describe, expect, it } from 'vitest'

import { resolveSelectedDayIndex } from './selectedDayIndex.ts'
import { buildWeekDays } from './weekDays.ts'

describe('resolveSelectedDayIndex', () => {
    const weekDays = buildWeekDays('2026-08-18')

    it('finds the tapped day among the seven parallel shift queries', () => {
        // Переключение дня: клик по «Пт» ленты недели должен показать состав смены пятницы, а не
        // дня, с которого страница была открыта.
        expect(resolveSelectedDayIndex(weekDays, '2026-08-21')).toBe(4)
    })

    it('resolves the first day of the week (todayIso itself) to index 0', () => {
        expect(resolveSelectedDayIndex(weekDays, '2026-08-17')).toBe(0)
    })

    it('falls back to index 0 when the date is outside the built week', () => {
        expect(resolveSelectedDayIndex(weekDays, '2026-09-01')).toBe(0)
    })
})
