import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { HeaderDesktop } from './HeaderDesktop'
import { HeaderMobile } from './HeaderMobile'

const user = { name: 'Артём Мурыгин', initials: 'АМ' }

function renderDesktop(onLogout = vi.fn(), onItemClick = vi.fn()) {
    render(
        <MemoryRouter>
            <HeaderDesktop
                navItems={[]}
                user={user}
                profileMenu={{
                    items: [{ label: 'Баланс', icon: null, to: '/balance/employee/1', onClick: onItemClick }],
                    onLogout,
                }}
            />
        </MemoryRouter>,
    )
    return { onLogout, onItemClick }
}

function renderMobile(onLogout = vi.fn(), onItemClick = vi.fn()) {
    render(
        <MemoryRouter>
            <HeaderMobile
                page="План продаж"
                menuOpen={false}
                onMenuToggle={() => {}}
                user={user}
                profileMenu={{
                    items: [{ label: 'Баланс', icon: null, to: '/balance/employee/1', onClick: onItemClick }],
                    onLogout,
                }}
            />
        </MemoryRouter>,
    )
    return { onLogout, onItemClick }
}

describe('ProfileMenu (desktop popover)', () => {
    it('opens on the user block trigger and shows the user + items + logout row', async () => {
        renderDesktop()

        expect(screen.queryByText('Выйти')).not.toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: /Артём Мурыгин/ }))

        expect(await screen.findByText('Выйти')).toBeInTheDocument()
        expect(screen.getByText('Баланс')).toBeInTheDocument()
    })

    it('calls onLogout and closes when «Выйти» is clicked', async () => {
        const { onLogout } = renderDesktop()

        await userEvent.click(screen.getByRole('button', { name: /Артём Мурыгин/ }))
        await userEvent.click(await screen.findByText('Выйти'))

        expect(onLogout).toHaveBeenCalledTimes(1)
        expect(screen.queryByText('Выйти')).not.toBeInTheDocument()
    })

    it('calls the item onClick and closes when a nav item is clicked', async () => {
        const { onItemClick } = renderDesktop()

        await userEvent.click(screen.getByRole('button', { name: /Артём Мурыгин/ }))
        await userEvent.click(await screen.findByText('Баланс'))

        expect(onItemClick).toHaveBeenCalledTimes(1)
        expect(screen.queryByText('Выйти')).not.toBeInTheDocument()
    })
})

describe('ProfileMenu (mobile sheet)', () => {
    it('opens on the avatar tap and shows the user + items + logout row', async () => {
        renderMobile()

        const sheet = document.querySelector('[data-slot="profile-menu-sheet"]')
        expect(sheet).toHaveAttribute('aria-hidden', 'true')

        await userEvent.click(screen.getByRole('button', { name: 'Артём Мурыгин' }))

        expect(sheet).toHaveAttribute('aria-hidden', 'false')
        expect(screen.getByText('Выйти')).toBeInTheDocument()
        expect(screen.getByText('Баланс')).toBeInTheDocument()
    })

    it('calls onLogout and closes the sheet when «Выйти» is tapped', async () => {
        const { onLogout } = renderMobile()

        await userEvent.click(screen.getByRole('button', { name: 'Артём Мурыгин' }))
        await userEvent.click(screen.getByText('Выйти'))

        expect(onLogout).toHaveBeenCalledTimes(1)
        expect(document.querySelector('[data-slot="profile-menu-sheet"]')).toHaveAttribute('aria-hidden', 'true')
    })
})
