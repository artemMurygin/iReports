import { describe, expect, it } from 'vitest'
import type { BalanceSummaryEmployee } from 'ireports-contracts'

import { buildEmployeeRowVM } from './employeeRow.ts'

function makeEmployee(overrides: Partial<BalanceSummaryEmployee> = {}): BalanceSummaryEmployee {
    return {
        employeeId: 1,
        employeeName: 'Ковалёв Артём',
        departmentId: 10,
        departmentName: 'Отдел сервиса',
        position: 'Инженер',
        isDismissed: false,
        lastMovementAt: null,
        balance: 50100,
        ...overrides,
    }
}

describe('buildEmployeeRowVM', () => {
    it('formats a positive-balance, active employee row', () => {
        const vm = buildEmployeeRowVM(makeEmployee({ lastMovementAt: new Date(2026, 7, 21) }))
        expect(vm).toMatchObject({
            employeeId: 1,
            initials: 'КА',
            name: 'Ковалёв Артём',
            position: 'Инженер',
            departmentName: 'Отдел сервиса',
            lastMovementLabel: '21 авг 2026',
            balanceLabel: '50 100 ₽',
            isNegative: false,
            isDismissed: false,
        })
    })

    it('flags a negative balance', () => {
        const vm = buildEmployeeRowVM(makeEmployee({ balance: -5300 }))
        expect(vm.isNegative).toBe(true)
        expect(vm.balanceLabel).toBe('-5 300 ₽')
    })

    it('passes through isDismissed for the «Уволен» badge', () => {
        expect(buildEmployeeRowVM(makeEmployee({ isDismissed: true })).isDismissed).toBe(true)
        expect(buildEmployeeRowVM(makeEmployee({ isDismissed: false })).isDismissed).toBe(false)
    })

    it('renders "—" for a null lastMovementAt (no movements yet)', () => {
        expect(buildEmployeeRowVM(makeEmployee({ lastMovementAt: null })).lastMovementLabel).toBe('—')
    })

    it('keeps a null position as null (table hides the line entirely)', () => {
        expect(buildEmployeeRowVM(makeEmployee({ position: null })).position).toBeNull()
    })
})
