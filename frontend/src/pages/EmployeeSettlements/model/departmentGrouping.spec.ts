import { describe, expect, it } from 'vitest'
import type { BalanceSummaryEmployee } from 'ireports-contracts'

import { groupEmployeesByDepartment } from './departmentGrouping.ts'

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

describe('groupEmployeesByDepartment', () => {
    it('returns an empty array for an empty selection', () => {
        expect(groupEmployeesByDepartment([])).toEqual([])
    })

    it('groups a single department into one group with the right subtotal and count', () => {
        const employees = [
            makeEmployee({ employeeId: 1, balance: 50100 }),
            makeEmployee({ employeeId: 2, balance: 49200 }),
        ]
        const groups = groupEmployeesByDepartment(employees)

        expect(groups).toHaveLength(1)
        expect(groups[0]).toMatchObject({ departmentId: 10, departmentName: 'Отдел сервиса', balance: 99300 })
        expect(groups[0].employees).toHaveLength(2)
    })

    it('splits employees into separate groups per departmentId (Pencil wZnzC: "Отдел сервиса · 5 — 179 500 ₽")', () => {
        const employees = [
            makeEmployee({ employeeId: 1, departmentId: 10, departmentName: 'Отдел сервиса', balance: 50100 }),
            makeEmployee({ employeeId: 2, departmentId: 10, departmentName: 'Отдел сервиса', balance: 49200 }),
            makeEmployee({ employeeId: 3, departmentId: 20, departmentName: 'Магазин', balance: 25900 }),
        ]
        const groups = groupEmployeesByDepartment(employees)

        expect(groups.map((g) => g.departmentId)).toEqual([10, 20])
        expect(groups[0]).toMatchObject({ departmentName: 'Отдел сервиса', balance: 99300 })
        expect(groups[0].employees.map((e) => e.employeeId)).toEqual([1, 2])
        expect(groups[1]).toMatchObject({ departmentName: 'Магазин', balance: 25900 })
        expect(groups[1].employees.map((e) => e.employeeId)).toEqual([3])
    })

    it('orders groups by first appearance in the input, not alphabetically or by balance', () => {
        const employees = [
            makeEmployee({
                employeeId: 1,
                departmentId: 30,
                departmentName: 'Второй по алфавиту, но первый в списке',
                balance: 1,
            }),
            makeEmployee({ employeeId: 2, departmentId: 10, departmentName: 'Отдел сервиса', balance: 999999 }),
        ]
        const groups = groupEmployeesByDepartment(employees)
        expect(groups.map((g) => g.departmentId)).toEqual([30, 10])
    })

    it('preserves each employee’s relative order within its group', () => {
        const employees = [
            makeEmployee({ employeeId: 1, departmentId: 10, balance: 100 }),
            makeEmployee({ employeeId: 2, departmentId: 20, balance: 200 }),
            makeEmployee({ employeeId: 3, departmentId: 10, balance: 300 }),
        ]
        const groups = groupEmployeesByDepartment(employees)
        const serviceGroup = groups.find((g) => g.departmentId === 10)
        expect(serviceGroup?.employees.map((e) => e.employeeId)).toEqual([1, 3])
    })

    it('sums negative balances correctly into the subtotal (e.g. a department with a debtor)', () => {
        const employees = [
            makeEmployee({ employeeId: 1, departmentId: 10, balance: 16000 }),
            makeEmployee({ employeeId: 2, departmentId: 10, balance: -5300 }),
        ]
        const groups = groupEmployeesByDepartment(employees)
        expect(groups[0].balance).toBe(10700)
    })
})
