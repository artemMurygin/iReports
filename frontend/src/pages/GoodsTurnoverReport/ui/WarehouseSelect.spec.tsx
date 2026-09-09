import type { ComponentProps } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { WarehouseResponse } from 'ireports-contracts'

import { WarehouseSelect } from './WarehouseSelect.tsx'

// Radix `Select` (the primitive `WarehouseSelect` is built on, `shared/ui-kit/atoms/Select.tsx`)
// calls `hasPointerCapture`/`releasePointerCapture`/`scrollIntoView` on open/select — none of
// which jsdom implements. Same polyfill every Radix-Select-driving test in this codebase would
// need; scoped to this file (not the shared `src/test/setup.ts`) since this is the first spec to
// actually open one.
beforeAll(() => {
    window.HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
    window.HTMLElement.prototype.releasePointerCapture = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

const WAREHOUSES: WarehouseResponse[] = [
    { id: 1, name: 'Сервисный центр · Тверская' },
    { id: 2, name: 'Сервисный центр · Полежаевская' },
    { id: 3, name: 'Сервисный центр · Каширская' },
    { id: 4, name: 'Сервисный центр · ВДНХ' },
    { id: 5, name: 'Сервисный центр · Кузьминки' },
]

/**
 * `WarehouseSelect` renders its trigger twice — a desktop variant (Pencil node `M6ZfP`: подпись
 * «Склад ·» + значение + `chevron-down`) and a mobile `Chip` variant (node `Yu5pP`: иконка
 * `warehouse` + значение + `chevron-down`), same `hidden md:flex` / `flex md:hidden` convention as
 * `pages/EmployeeBalance/ui/BalanceFilters.tsx` (see that file's spec for the precedent) — jsdom
 * doesn't evaluate the `md:` media query, so both are present in the DOM at once. Every assertion
 * scopes into one variant via its `data-slot` container.
 */
function renderSelect(overrides: Partial<ComponentProps<typeof WarehouseSelect>> = {}) {
    const onSelect = vi.fn()
    const utils = render(
        <WarehouseSelect warehouses={WAREHOUSES} selectedWarehouseId={1} onSelect={onSelect} {...overrides} />,
    )
    const desktop = within(utils.container.querySelector('[data-slot="warehouse-select-desktop"]')!)
    const mobile = within(utils.container.querySelector('[data-slot="warehouse-select-mobile"]')!)
    return { ...utils, onSelect, desktop, mobile }
}

describe('WarehouseSelect — desktop trigger', () => {
    it('shows the "Склад ·" label and the currently selected warehouse name', () => {
        const { desktop } = renderSelect({ selectedWarehouseId: 2 })
        expect(desktop.getByText('Склад ·')).toBeInTheDocument()
        expect(desktop.getByText('Сервисный центр · Полежаевская')).toBeInTheDocument()
    })

    it('renders every warehouse from a list of arbitrary length (not capped to 3)', async () => {
        const user = userEvent.setup()
        const { desktop } = renderSelect()
        await user.click(desktop.getByRole('combobox'))
        for (const warehouse of WAREHOUSES) {
            expect(await screen.findByRole('option', { name: warehouse.name })).toBeInTheDocument()
        }
    })

    it('calls onSelect with the clicked warehouse id', async () => {
        const user = userEvent.setup()
        const { desktop, onSelect } = renderSelect({ selectedWarehouseId: 1 })
        await user.click(desktop.getByRole('combobox'))
        await user.click(await screen.findByRole('option', { name: 'Сервисный центр · Каширская' }))
        expect(onSelect).toHaveBeenCalledWith(3)
    })
})

describe('WarehouseSelect — mobile chip trigger', () => {
    it('shows only the selected warehouse name, no "Склад ·" label', () => {
        const { mobile } = renderSelect({ selectedWarehouseId: 4 })
        expect(mobile.getByText('Сервисный центр · ВДНХ')).toBeInTheDocument()
        expect(mobile.queryByText('Склад ·')).not.toBeInTheDocument()
    })

    it('calls onSelect with the clicked warehouse id', async () => {
        const user = userEvent.setup()
        const { mobile, onSelect } = renderSelect({ selectedWarehouseId: 1 })
        await user.click(mobile.getByRole('combobox'))
        await user.click(await screen.findByRole('option', { name: 'Сервисный центр · Кузьминки' }))
        expect(onSelect).toHaveBeenCalledWith(5)
    })
})

describe('WarehouseSelect — no selection', () => {
    it('renders without crashing when selectedWarehouseId is null', () => {
        const { desktop } = renderSelect({ selectedWarehouseId: null })
        expect(desktop.getByRole('combobox')).toBeInTheDocument()
    })
})
