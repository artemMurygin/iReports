import { describe, expect, it } from 'vitest'

import { buildEmployeeScheduleLink } from './employeeScheduleLink.ts'

describe('buildEmployeeScheduleLink', () => {
    it('points at the desktop table with the employee highlighted', () => {
        expect(buildEmployeeScheduleLink(42, '2026-08-18')).toBe('/work-schedule?employeeId=42&month=2026-08')
    })

    it('derives month from the tapped date, not the calendar month of "today"', () => {
        // Неделя ленты может пересекать границу месяца (см. weekDays.spec.ts) — ссылка должна
        // вести на месяц конкретного дня, по которому кликнули, а не на текущий.
        expect(buildEmployeeScheduleLink(1, '2026-09-01')).toBe('/work-schedule?employeeId=1&month=2026-09')
    })
})
