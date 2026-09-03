import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { NavDrawer } from './NavDrawer'

/**
 * Phase 3 (header-navigation-fixes PRD): `NavDrawer` used to derive each item's active state
 * independently from `react-router-dom`'s own `NavLink` `isActive` (a per-item path-prefix
 * match) — the same class of bug already fixed for `HeaderDesktop`'s nav pills and `Subnav`'s
 * tabs (Phases 1-2). `NavDrawer` now trusts only the caller-supplied `active` flag (computed once
 * in `app/Header.tsx` via `findMostSpecificNavMatch` against the full leaf list) instead of
 * recomputing its own match per item, so a sibling item whose `to` still prefix-matches the route
 * does not light up alongside the actually-current one.
 */
function renderDrawer(pathname: string) {
    render(
        <MemoryRouter initialEntries={[pathname]}>
            <NavDrawer
                open
                onClose={() => {}}
                sections={[
                    {
                        label: 'Зарплата',
                        items: [
                            { label: 'Отчёт по зарплате', to: '/salaries', icon: null, active: false },
                            { label: 'Начисления', to: '/salary-accruals', icon: null, active: false },
                            { label: 'Взаиморасчёты', to: '/balance', icon: null, active: false },
                            { label: 'Правила начисления', to: '/salaries/rules', icon: null, active: true },
                        ],
                    },
                ]}
            />
        </MemoryRouter>,
    )
}

describe('NavDrawer', () => {
    it('marks only the item flagged `active` as current on /salaries/rules', () => {
        renderDrawer('/salaries/rules')

        expect(screen.getByRole('link', { name: /Правила начисления/ })).toHaveAttribute('aria-current', 'page')

        // "Отчёт по зарплате" links to `/salaries`, which still prefix-matches `/salaries/rules` —
        // it must NOT show as current despite that, since it wasn't the item flagged `active`.
        expect(screen.getByRole('link', { name: /Отчёт по зарплате/ })).not.toHaveAttribute('aria-current', 'page')
        expect(screen.getByRole('link', { name: /Начисления/ })).not.toHaveAttribute('aria-current', 'page')
        expect(screen.getByRole('link', { name: /Взаиморасчёты/ })).not.toHaveAttribute('aria-current', 'page')

        expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1)
    })

    it('marks no item active when none is flagged `active`, even if a `to` prefix-matches', () => {
        render(
            <MemoryRouter initialEntries={['/salaries/rules']}>
                <NavDrawer
                    open
                    onClose={() => {}}
                    sections={[
                        {
                            items: [
                                { label: 'Отчёт по зарплате', to: '/salaries', icon: null, active: false },
                                { label: 'Правила начисления', to: '/salaries/rules', icon: null, active: false },
                            ],
                        },
                    ]}
                />
            </MemoryRouter>,
        )

        expect(screen.queryAllByRole('link', { current: 'page' })).toHaveLength(0)
    })

    it('renders a disabled item as a non-interactive placeholder regardless of `active`', () => {
        render(
            <MemoryRouter initialEntries={['/salaries/period']}>
                <NavDrawer
                    open
                    onClose={() => {}}
                    sections={[
                        {
                            items: [
                                {
                                    label: 'Отчётный период',
                                    to: '/salaries/period',
                                    icon: null,
                                    disabled: true,
                                    active: true,
                                },
                            ],
                        },
                    ]}
                />
            </MemoryRouter>,
        )

        expect(screen.queryByRole('link')).not.toBeInTheDocument()
        expect(screen.getByText('Отчётный период')).toBeInTheDocument()
    })
})
