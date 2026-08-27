import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BalanceTransactionType } from 'ireports-contracts'

import { BalanceFilters } from './BalanceFilters.tsx'

/**
 * `BalanceFilters` renders its chip row twice — once for the desktop layout (`hidden md:flex`)
 * and once for the mobile layout (`flex md:hidden`), same trick as `TransactionsLedger`/
 * `TransactionsCardList` (frontend/CLAUDE.md convention: separate mobile/desktop markup, CSS
 * decides which is visible). jsdom doesn't evaluate the `md:` media query, so BOTH are present in
 * the DOM at once — every assertion below scopes into one variant via its `data-slot` container
 * (`within`) instead of querying the whole `render()` result, to avoid "found multiple elements"
 * errors on chip labels shared by both layouts.
 */
function renderFilters(overrides: Partial<ComponentProps<typeof BalanceFilters>> = {}) {
    const onToggleType = vi.fn()
    const onClearTypes = vi.fn()
    const onSearchChange = vi.fn()
    const utils = render(
        <BalanceFilters
            selectedTypes={[]}
            onToggleType={onToggleType}
            onClearTypes={onClearTypes}
            search=""
            onSearchChange={onSearchChange}
            {...overrides}
        />,
    )
    const desktop = within(utils.container.querySelector('[data-slot="employee-balance-filters-desktop"]')!)
    const mobile = within(utils.container.querySelector('[data-slot="employee-balance-filters-mobile"]')!)
    return { ...utils, onToggleType, onClearTypes, onSearchChange, desktop, mobile }
}

describe('BalanceFilters — type chip filtering', () => {
    it('renders "Все типы" as active when no type is selected', () => {
        const { desktop } = renderFilters({ selectedTypes: [] })
        expect(desktop.getByRole('button', { name: 'Все типы' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('renders all 10 types on the desktop layout', () => {
        const { desktop } = renderFilters()
        for (const label of [
            'Начисление',
            'Корректировка начисления',
            'Аванс',
            'Доп. аванс',
            'Премия',
            'Больничный',
            'Отпускные',
            'Штраф',
            'Корректировка вручную',
            'Выплата',
        ]) {
            expect(desktop.getByRole('button', { name: label })).toBeInTheDocument()
        }
    })

    it('calls onToggleType with the clicked type', async () => {
        const user = userEvent.setup()
        const { desktop, onToggleType } = renderFilters()
        await user.click(desktop.getByRole('button', { name: 'Штраф' }))
        expect(onToggleType).toHaveBeenCalledWith('PENALTY')
    })

    it('marks a selected type as pressed and "Все типы" as not pressed', () => {
        const selectedTypes: BalanceTransactionType[] = ['ADVANCE']
        const { desktop } = renderFilters({ selectedTypes })
        expect(desktop.getByRole('button', { name: 'Аванс' })).toHaveAttribute('aria-pressed', 'true')
        expect(desktop.getByRole('button', { name: 'Все типы' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('calls onClearTypes when "Все типы" is clicked', async () => {
        const user = userEvent.setup()
        const { desktop, onClearTypes } = renderFilters({ selectedTypes: ['ADVANCE'] })
        await user.click(desktop.getByRole('button', { name: 'Все типы' }))
        expect(onClearTypes).toHaveBeenCalledTimes(1)
    })
})

describe('BalanceFilters — mobile "Ещё N" overflow', () => {
    it('shows only the first 5 types plus an "Ещё 5" chip, hiding the rest', () => {
        const { mobile } = renderFilters()
        expect(mobile.getByRole('button', { name: 'Начисление' })).toBeInTheDocument()
        expect(mobile.getByRole('button', { name: 'Премия' })).toBeInTheDocument()
        expect(mobile.getByRole('button', { name: 'Ещё 5' })).toBeInTheDocument()
        expect(mobile.queryByRole('button', { name: 'Штраф' })).not.toBeInTheDocument()
        expect(mobile.queryByRole('button', { name: 'Выплата' })).not.toBeInTheDocument()
    })

    it('reveals the remaining type chips after clicking "Ещё N"', async () => {
        const user = userEvent.setup()
        const { mobile } = renderFilters()
        await user.click(mobile.getByRole('button', { name: 'Ещё 5' }))
        expect(mobile.getByRole('button', { name: 'Штраф' })).toBeInTheDocument()
        expect(mobile.getByRole('button', { name: 'Выплата' })).toBeInTheDocument()
        expect(mobile.queryByRole('button', { name: 'Ещё 5' })).not.toBeInTheDocument()
    })
})

describe('BalanceFilters — comment search', () => {
    it('calls onSearchChange as the user types into the search input', async () => {
        const user = userEvent.setup()
        const { onSearchChange } = renderFilters()
        const inputs = screen.getAllByRole('searchbox', { name: 'Поиск по комментарию' })
        await user.type(inputs[0], 'аванс')
        expect(onSearchChange).toHaveBeenCalled()
        expect(onSearchChange.mock.calls.map((call) => call[0]).join('')).toBe('аванс')
    })

    it('shows the current search value in the input', () => {
        const { desktop } = renderFilters({ search: 'штраф' })
        expect(desktop.getByRole('searchbox', { name: 'Поиск по комментарию' })).toHaveValue('штраф')
    })
})
