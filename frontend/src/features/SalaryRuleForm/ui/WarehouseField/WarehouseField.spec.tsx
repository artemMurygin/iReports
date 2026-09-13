import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { WarehouseField } from './WarehouseField.tsx'

/**
 * FR4 of add-department-head-salary-rules — `DepartmentTurnoverBonus`'s warehouse field.
 *
 * `warehouses[].id` is `number` for service (RoApp warehouse id) and `string` for shop (MoySklad
 * UUID) — both lists below are exercised to prove `WarehouseField` is domain-agnostic (it always
 * reports/compares `String(id)`, matching `RuleDraft.warehouseId: string`).
 */
const SERVICE_WAREHOUSES = [
    { id: 1, name: 'Сервисный центр · Тверская' },
    { id: 2, name: 'Сервисный центр · Полежаевская' },
    { id: 7, name: 'Сервисный центр · Каширская' },
]

const SHOP_WAREHOUSES = [
    { id: 'wh-uuid-1', name: 'Магазин · Тверская' },
    { id: 'wh-uuid-2', name: 'Магазин · Полежаевская' },
]

function renderField(overrides: Partial<ComponentProps<typeof WarehouseField>> = {}) {
    const onValueChange = vi.fn()
    const utils = render(
        <WarehouseField value="" onValueChange={onValueChange} warehouses={SERVICE_WAREHOUSES} {...overrides} />,
    )
    return { ...utils, onValueChange }
}

describe('WarehouseField — renders the list of warehouses', () => {
    it('shows every warehouse from the list once opened', async () => {
        const user = userEvent.setup()
        renderField()

        await user.click(screen.getByRole('button', { name: /выберите склад/i }))

        for (const warehouse of SERVICE_WAREHOUSES) {
            expect(await screen.findByText(warehouse.name)).toBeInTheDocument()
        }
    })

    it('shows a placeholder in the trigger when no warehouse is selected yet', () => {
        renderField({ value: '' })
        expect(screen.getByRole('button', { name: 'Выберите склад' })).toBeInTheDocument()
    })

    it('shows the currently selected warehouse name in the trigger', () => {
        renderField({ value: '2' })
        expect(screen.getByRole('button', { name: 'Сервисный центр · Полежаевская' })).toBeInTheDocument()
    })
})

describe('WarehouseField — onValueChange', () => {
    it('calls onValueChange with the clicked warehouse id, stringified (service, numeric RoApp id)', async () => {
        const user = userEvent.setup()
        const { onValueChange } = renderField({ warehouses: SERVICE_WAREHOUSES })

        await user.click(screen.getByRole('button', { name: /выберите склад/i }))
        await user.click(await screen.findByText('Сервисный центр · Каширская'))

        expect(onValueChange).toHaveBeenCalledWith('7')
    })

    it('calls onValueChange with the clicked warehouse id (shop, MoySklad UUID string id)', async () => {
        const user = userEvent.setup()
        const { onValueChange } = renderField({ warehouses: SHOP_WAREHOUSES })

        await user.click(screen.getByRole('button', { name: /выберите склад/i }))
        await user.click(await screen.findByText('Магазин · Полежаевская'))

        expect(onValueChange).toHaveBeenCalledWith('wh-uuid-2')
    })

    it('closes the popover after a selection', async () => {
        const user = userEvent.setup()
        renderField()

        await user.click(screen.getByRole('button', { name: /выберите склад/i }))
        await user.click(await screen.findByText('Сервисный центр · Тверская'))

        expect(screen.queryByText('Сервисный центр · Полежаевская')).not.toBeInTheDocument()
    })
})

describe('WarehouseField — required for DepartmentTurnoverBonus (FR4)', () => {
    // FR4: склад — обязательное поле конфигурации DepartmentTurnoverBonus (design.md, Decision 2) —
    // в отличие от CategoryField/OrderTypeField компонент не даёт способа сбросить выбор в "пусто"/
    // "все склады".
    it('renders no "Сбросить"/reset-to-empty affordance, unlike the optional CategoryField/OrderTypeField', async () => {
        const user = userEvent.setup()
        renderField({ value: '2' })

        await user.click(screen.getByRole('button', { name: 'Сервисный центр · Полежаевская' }))

        expect(screen.queryByText(/сбросить/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/все склады/i)).not.toBeInTheDocument()
    })
})

describe('WarehouseField — loading/error states', () => {
    it('shows a loading label and disables the trigger while isLoading', () => {
        renderField({ isLoading: true })
        const trigger = screen.getByRole('button', { name: /загрузка/i })
        expect(trigger).toBeDisabled()
    })

    it('shows an error label when the warehouse list failed to load', () => {
        renderField({ error: 'network error', warehouses: [] })
        expect(screen.getByRole('button', { name: /не удалось загрузить/i })).toBeInTheDocument()
    })
})
