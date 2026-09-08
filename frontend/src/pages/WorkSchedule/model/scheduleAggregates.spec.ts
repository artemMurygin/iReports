import { describe, expect, it } from 'vitest'

import { buildDayAggregateMap, buildEmployeeCellMap, isVacationLow, vacationDaysRemaining } from './scheduleAggregates.ts'

function cell(date: string) {
    return { date, entryId: null, status: null, hours: null, role: null, isOnDuty: false }
}

describe('buildEmployeeCellMap', () => {
    it('keys cells by date', () => {
        const map = buildEmployeeCellMap({ days: [cell('2026-08-01'), cell('2026-08-02')] })
        expect(map.get('2026-08-01')).toEqual(cell('2026-08-01'))
        expect(map.get('2026-08-02')).toEqual(cell('2026-08-02'))
        expect(map.get('2026-08-03')).toBeUndefined()
    })
})

describe('buildDayAggregateMap', () => {
    it('keys peopleOnShift by date', () => {
        const map = buildDayAggregateMap([
            { date: '2026-08-01', peopleOnShift: 3 },
            { date: '2026-08-02', peopleOnShift: 2 },
        ])
        expect(map.get('2026-08-01')).toBe(3)
        expect(map.get('2026-08-02')).toBe(2)
        expect(map.get('2026-08-03')).toBeUndefined()
    })
})

describe('vacationDaysRemaining', () => {
    it('subtracts used from limit', () => {
        expect(vacationDaysRemaining({ vacationDaysUsed: 9, vacationDaysLimit: 31 })).toBe(22)
    })

    it('never goes negative even if used somehow exceeds the limit', () => {
        expect(vacationDaysRemaining({ vacationDaysUsed: 35, vacationDaysLimit: 31 })).toBe(0)
    })
})

describe('isVacationLow', () => {
    it('flags a single-digit remaining balance', () => {
        expect(isVacationLow(9)).toBe(true)
        expect(isVacationLow(0)).toBe(true)
    })

    it('does not flag a double-digit remaining balance', () => {
        expect(isVacationLow(10)).toBe(false)
        expect(isVacationLow(13)).toBe(false)
        expect(isVacationLow(31)).toBe(false)
    })
})
