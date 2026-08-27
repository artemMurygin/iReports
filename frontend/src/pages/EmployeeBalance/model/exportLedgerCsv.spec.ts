import { describe, expect, it } from 'vitest'
import type { BalanceTransaction } from 'ireports-contracts'

import { buildEmployeeBalanceLedgerCsv } from './exportLedgerCsv.ts'

function makeTransaction(overrides: Partial<BalanceTransaction> = {}): BalanceTransaction {
    return {
        id: 'tx-1',
        employeeId: 1,
        direction: 'service',
        type: 'ADVANCE',
        amount: -20000,
        occurredAt: new Date(2026, 7, 5),
        createdAt: new Date(2026, 7, 5),
        createdBy: 2,
        comment: 'Аванс за первую половину августа',
        period: null,
        accrualId: null,
        lineId: null,
        ruleId: null,
        erpSyncRequired: false,
        erp: null,
        ...overrides,
    }
}

const EMPLOYEE_NAME_BY_ID = { 2: 'Петров И.' }

describe('buildEmployeeBalanceLedgerCsv', () => {
    it('starts with a BOM and the header row', () => {
        const csv = buildEmployeeBalanceLedgerCsv([], {})
        expect(csv.startsWith('﻿')).toBe(true)
        expect(csv.replace('﻿', '').split('\r\n')[0]).toBe('Дата;Тип;Направление;Сумма, ₽;Комментарий;Автор;Документ')
    })

    it('renders one row per transaction with a raw signed amount and the resolved author name', () => {
        const csv = buildEmployeeBalanceLedgerCsv([makeTransaction()], EMPLOYEE_NAME_BY_ID)
        const row = csv.replace('﻿', '').split('\r\n')[1]
        expect(row).toBe('5 авг 2026;Аванс;Сервис;-20000;Аванс за первую половину августа;Петров И.;')
    })

    it('falls back to "ID <id>" when the author is not in the map', () => {
        const csv = buildEmployeeBalanceLedgerCsv([makeTransaction({ createdBy: 99 })], EMPLOYEE_NAME_BY_ID)
        const row = csv.replace('﻿', '').split('\r\n')[1]
        expect(row).toContain('ID 99')
    })

    it('shows the ERP document external id when present', () => {
        const csv = buildEmployeeBalanceLedgerCsv(
            [makeTransaction({ erp: { system: 'ROAPP', externalId: '№48213' } })],
            EMPLOYEE_NAME_BY_ID,
        )
        expect(csv).toContain('№48213')
    })

    it('shows "Документ начисления" for an accrual-linked transaction without an ERP document', () => {
        const csv = buildEmployeeBalanceLedgerCsv(
            [makeTransaction({ type: 'SALARY_ACCRUAL', amount: 68400, accrualId: 'accrual-1' })],
            EMPLOYEE_NAME_BY_ID,
        )
        expect(csv).toContain('Документ начисления')
    })

    it('quotes a comment containing the delimiter or a newline', () => {
        const csv = buildEmployeeBalanceLedgerCsv(
            [makeTransaction({ comment: 'Штраф; опоздание\nсогласовано' })],
            EMPLOYEE_NAME_BY_ID,
        )
        expect(csv).toContain('"Штраф; опоздание\nсогласовано"')
    })
})
