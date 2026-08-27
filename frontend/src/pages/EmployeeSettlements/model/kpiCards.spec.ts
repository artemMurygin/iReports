import { describe, expect, it } from 'vitest'
import type { BalanceSummaryTotals } from 'ireports-contracts'

import { formatCurrency } from '@/shared/lib/format.ts'

import { buildSettlementsKpiCards } from './kpiCards.ts'

const TOTALS: BalanceSummaryTotals = {
    balance: 238900,
    toPay: { amount: 244200, count: 7 },
    debt: { amount: -5300, count: 1 },
}

describe('buildSettlementsKpiCards', () => {
    it('builds the three cards from totals, matching IFJW2 order/labels', () => {
        const cards = buildSettlementsKpiCards(TOTALS, 8)
        expect(cards.map((card) => card.key)).toEqual(['balance', 'toPay', 'debt'])
        expect(cards.map((card) => card.label)).toEqual([
            'Общий остаток',
            'К выплате сотрудникам',
            'Долг сотрудников компании',
        ])
    })

    it('formats each value with formatCurrency, keeping the debt amount’s own sign (no extra +/-)', () => {
        const [balance, toPay, debt] = buildSettlementsKpiCards(TOTALS, 8)
        expect(balance.value).toBe(formatCurrency(238900))
        expect(toPay.value).toBe(formatCurrency(244200))
        expect(debt.value).toBe(formatCurrency(-5300))
        expect(debt.value.startsWith('-')).toBe(true)
    })

    it('pluralizes the note counts correctly (1 vs 7 vs employeesCount)', () => {
        const cards = buildSettlementsKpiCards(TOTALS, 8)
        expect(cards[0].note).toBe('8 сотрудников · сальдо на текущий момент')
        expect(cards[1].note).toBe('7 сотрудников с положительным остатком')
        expect(cards[2].note).toBe('1 сотрудник с отрицательным остатком')
    })

    it('renders zero totals (empty/no-debt selection) without dividing by zero or crashing', () => {
        const cards = buildSettlementsKpiCards({ balance: 0, toPay: { amount: 0, count: 0 }, debt: { amount: 0, count: 0 } }, 0)
        expect(cards[1].note).toBe('0 сотрудников с положительным остатком')
        expect(cards[2].note).toBe('0 сотрудников с отрицательным остатком')
    })
})
