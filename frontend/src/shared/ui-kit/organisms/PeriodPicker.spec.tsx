import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PeriodPicker } from './PeriodPicker.tsx'

// Radix `Popover` — same jsdom gaps as the Radix `Select` in `WarehouseSelect.spec.tsx` (that
// file's comment explains why): `hasPointerCapture`/`releasePointerCapture`/`scrollIntoView`
// aren't implemented by jsdom.
beforeAll(() => {
    window.HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
    window.HTMLElement.prototype.releasePointerCapture = vi.fn()
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

/**
 * Two independent triggers (desktop `Popover` + mobile `Popover`, same `hidden md:flex`/
 * `flex md:hidden` convention as `WarehouseSelect`) render in jsdom at once — scope every
 * assertion into one variant via its `data-slot` container, same precedent as
 * `WarehouseSelect.spec.tsx`.
 */
function renderPicker(overrides: Partial<React.ComponentProps<typeof PeriodPicker>> = {}) {
    const onChange = vi.fn()
    const utils = render(<PeriodPicker period="2026-08" onChange={onChange} {...overrides} />)
    const desktop = within(utils.container.querySelector('[data-slot="period-picker-desktop"]')!)
    const mobile = within(utils.container.querySelector('[data-slot="period-picker-mobile"]')!)
    return { ...utils, onChange, desktop, mobile }
}

describe('PeriodPicker — desktop trigger', () => {
    it('shows the "Период ·" label and the formatted month', () => {
        const { desktop } = renderPicker()
        expect(desktop.getByText('Период ·')).toBeInTheDocument()
        expect(desktop.getByText('август 2026')).toBeInTheDocument()
    })

    it('shifts to the next month when the popover\'s next arrow is clicked', async () => {
        const user = userEvent.setup()
        const { desktop, onChange } = renderPicker()
        await user.click(desktop.getByRole('button'))
        await user.click(await screen.findByRole('button', { name: 'Следующий месяц' }))
        expect(onChange).toHaveBeenCalledWith('2026-09')
    })

    it('shifts to the previous month when the popover\'s previous arrow is clicked', async () => {
        const user = userEvent.setup()
        const { desktop, onChange } = renderPicker()
        await user.click(desktop.getByRole('button'))
        await user.click(await screen.findByRole('button', { name: 'Предыдущий месяц' }))
        expect(onChange).toHaveBeenCalledWith('2026-07')
    })

    it('disables the next arrow once the current period reaches maxPeriod, without calling onChange', async () => {
        const user = userEvent.setup()
        const { desktop, onChange } = renderPicker({ period: '2026-08', maxPeriod: '2026-08' })
        await user.click(desktop.getByRole('button'))
        const next = await screen.findByRole('button', { name: 'Следующий месяц' })
        expect(next).toBeDisabled()
        expect(onChange).not.toHaveBeenCalled()
    })
})

describe('PeriodPicker — mobile trigger', () => {
    it('shows only the formatted month, no "Период ·" label', () => {
        const { mobile } = renderPicker()
        expect(mobile.getByText('август 2026')).toBeInTheDocument()
        expect(mobile.queryByText('Период ·')).not.toBeInTheDocument()
    })
})
