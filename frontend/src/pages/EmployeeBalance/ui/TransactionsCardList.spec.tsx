import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { BalanceTransaction } from 'ireports-contracts'

import { TransactionsCardList } from './TransactionsCardList.tsx'

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

function renderCardList(transactions: BalanceTransaction[]) {
    return render(
        <MemoryRouter>
            <TransactionsCardList
                transactions={transactions}
                employeeNameById={{ 2: 'Петров И.' }}
                onDeleteTransaction={vi.fn()}
                onDeletePayout={vi.fn()}
            />
        </MemoryRouter>,
    )
}

describe('TransactionsCardList — direction sub-label per row', () => {
    it('renders "Сервис" under the type for a service-direction transaction', () => {
        renderCardList([makeTransaction({ id: 'tx-1', direction: 'service' })])
        const card = screen.getByText('Аванс').closest('[data-slot="transaction-card"]') as HTMLElement
        expect(within(card).getByText('Сервис')).toBeInTheDocument()
    })

    it('renders "Магазин" under the type for a shop-direction transaction', () => {
        renderCardList([makeTransaction({ id: 'tx-1', direction: 'shop', type: 'PENALTY', amount: -3200 })])
        const card = screen.getByText('Штраф').closest('[data-slot="transaction-card"]') as HTMLElement
        expect(within(card).getByText('Магазин')).toBeInTheDocument()
    })

    it('renders the correct direction independently for each row', () => {
        renderCardList([
            makeTransaction({ id: 'tx-1', direction: 'service', type: 'ADVANCE' }),
            makeTransaction({ id: 'tx-2', direction: 'shop', type: 'BONUS', amount: 3500, comment: 'Перевыполнение плана' }),
        ])

        const serviceCard = screen.getByText('Аванс').closest('[data-slot="transaction-card"]') as HTMLElement
        const shopCard = screen.getByText('Премия').closest('[data-slot="transaction-card"]') as HTMLElement
        expect(within(serviceCard).getByText('Сервис')).toBeInTheDocument()
        expect(within(shopCard).getByText('Магазин')).toBeInTheDocument()
    })

    it('shows an ERP document link instead of the accrual document link when both could apply', () => {
        renderCardList([
            makeTransaction({
                type: 'PAYOUT',
                amount: -45000,
                erp: { system: 'ROAPP', externalId: '№48213' },
            }),
        ])
        expect(screen.getByText(/RemOnline №48213/)).toBeInTheDocument()
    })

    it('shows the accrual document link when there is no ERP document', () => {
        renderCardList([makeTransaction({ type: 'SALARY_ACCRUAL', amount: 68400, accrualId: 'accrual-1' })])
        expect(screen.getByRole('link', { name: /Документ начисления/ })).toHaveAttribute(
            'href',
            '/salary-accruals/accrual-1?direction=service',
        )
    })
})
