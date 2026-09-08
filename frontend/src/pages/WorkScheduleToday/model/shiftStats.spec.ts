import { describe, expect, it } from 'vitest'

import { notOnShiftCount, totalEmployeesOfShift } from './shiftStats.ts'

describe('totalEmployeesOfShift', () => {
    it('sums onShift with every absence group', () => {
        const total = totalEmployeesOfShift({
            onShift: [{ employeeId: 1, name: 'А', role: 'ENGINEER', hours: 8 }],
            notOnShift: [
                { reason: 'DAY_OFF', employees: [{ employeeId: 2, name: 'Б' }, { employeeId: 3, name: 'В' }] },
                { reason: 'SICK_LEAVE', employees: [{ employeeId: 4, name: 'Г' }] },
            ],
        })
        expect(total).toBe(4)
    })

    it('returns just onShift length when nobody is absent', () => {
        const total = totalEmployeesOfShift({
            onShift: [
                { employeeId: 1, name: 'А', role: 'ENGINEER', hours: 8 },
                { employeeId: 2, name: 'Б', role: 'OFFICE', hours: 6 },
            ],
            notOnShift: [],
        })
        expect(total).toBe(2)
    })

    it('returns 0 for an empty department', () => {
        expect(totalEmployeesOfShift({ onShift: [], notOnShift: [] })).toBe(0)
    })
})

describe('notOnShiftCount', () => {
    it('sums employees across every absence group', () => {
        const count = notOnShiftCount([
            { reason: 'DAY_OFF', employees: [{ employeeId: 2, name: 'Б' }, { employeeId: 3, name: 'В' }] },
            { reason: 'SICK_LEAVE', employees: [{ employeeId: 4, name: 'Г' }] },
            { reason: 'NOT_FILLED', employees: [] },
        ])
        expect(count).toBe(3)
    })

    it('returns 0 when everybody is on shift', () => {
        expect(notOnShiftCount([])).toBe(0)
    })
})
