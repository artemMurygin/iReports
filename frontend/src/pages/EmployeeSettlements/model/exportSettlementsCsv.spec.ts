import { describe, expect, it } from 'vitest'
import type { BalanceSummaryEmployee, BalanceSummaryTotals } from 'ireports-contracts'

import { buildEmployeeSettlementsCsv } from './exportSettlementsCsv.ts'

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

const TOTALS: BalanceSummaryTotals = {
    balance: 238900,
    toPay: { amount: 244200, count: 7 },
    debt: { amount: -5300, count: 1 },
}

describe('buildEmployeeSettlementsCsv', () => {
    it('starts with a BOM and the header row', () => {
        const csv = buildEmployeeSettlementsCsv([], {
            balance: 0,
            toPay: { amount: 0, count: 0 },
            debt: { amount: 0, count: 0 },
        })
        expect(csv.startsWith('﻿')).toBe(true)
        expect(csv.replace('﻿', '').split('\r\n')[0]).toBe(
            'Сотрудник;Должность;Отдел;Статус;Последнее движение;Остаток, ₽',
        )
    })

    it('renders one row per employee with a raw (unformatted) balance number, plus a final "Итого" row', () => {
        const csv = buildEmployeeSettlementsCsv(
            [
                makeEmployee({ lastMovementAt: new Date(2026, 7, 21) }),
                makeEmployee({ employeeId: 2, employeeName: 'Никитин Максим', balance: -5300 }),
            ],
            TOTALS,
        )
        const lines = csv.replace('﻿', '').split('\r\n')
        expect(lines).toHaveLength(4)
        expect(lines[1]).toBe('Ковалёв Артём;Инженер;Отдел сервиса;;21 авг 2026;50100')
        expect(lines[2]).toBe('Никитин Максим;Инженер;Отдел сервиса;;—;-5300')
        expect(lines[3]).toBe('Итого;;;;;238900')
    })

    it("marks a dismissed employee's status column and falls back to an empty position", () => {
        const csv = buildEmployeeSettlementsCsv([makeEmployee({ isDismissed: true, position: null })], TOTALS)
        const row = csv.replace('﻿', '').split('\r\n')[1]
        expect(row).toBe('Ковалёв Артём;;Отдел сервиса;Уволен;—;50100')
    })
})
