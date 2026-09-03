import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { Subnav } from './Subnav'

/**
 * Bug 2 (header-navigation-fixes PRD): `Subnav` used to derive each tab's active state
 * independently from `react-router-dom`'s own `NavLink` `isActive` (a per-tab path-prefix match).
 * With `end: false` (the default), a shorter tab like "Отчёт по зарплате" (`/salaries`) matched
 * every nested path too, so on `/salaries/rules` it stayed lit at the same time as the more
 * specific "Правила начисления" (`/salaries/rules`) — two tabs active simultaneously.
 *
 * `Subnav` now trusts only the caller-supplied `active` flag (computed once, by picking the most
 * specific match among the section's tabs — see `app/Header.tsx`) rather than recomputing its own
 * match per tab. This locks in that exactly the tab flagged `active` renders as current, even when
 * a *different* tab's own `to` would still prefix-match the route.
 */
function renderTabs(pathname: string) {
    render(
        <MemoryRouter initialEntries={[pathname]}>
            <Subnav
                tabs={[
                    { label: 'Отчёт по зарплате', to: '/salaries', active: false },
                    { label: 'Начисления', to: '/salary-accruals', active: false },
                    { label: 'Взаиморасчёты', to: '/balance', active: false },
                    { label: 'Правила начисления', to: '/salaries/rules', active: true },
                ]}
            />
        </MemoryRouter>,
    )
}

describe('Subnav', () => {
    it('marks only the tab flagged `active` as current on /salaries/rules', () => {
        renderTabs('/salaries/rules')

        expect(screen.getByRole('link', { name: 'Правила начисления' })).toHaveAttribute('aria-current', 'page')

        // "Отчёт по зарплате" links to `/salaries`, which still prefix-matches `/salaries/rules` —
        // it must NOT show as current despite that, since it wasn't the most specific match.
        expect(screen.getByRole('link', { name: 'Отчёт по зарплате' })).not.toHaveAttribute('aria-current', 'page')
        expect(screen.getByRole('link', { name: 'Начисления' })).not.toHaveAttribute('aria-current', 'page')
        expect(screen.getByRole('link', { name: 'Взаиморасчёты' })).not.toHaveAttribute('aria-current', 'page')

        expect(screen.getAllByRole('link', { current: 'page' })).toHaveLength(1)
    })

    it('marks no tab active when none is flagged `active`, even if a `to` prefix-matches', () => {
        render(
            <MemoryRouter initialEntries={['/salaries/rules']}>
                <Subnav
                    tabs={[
                        { label: 'Отчёт по зарплате', to: '/salaries', active: false },
                        { label: 'Правила начисления', to: '/salaries/rules', active: false },
                    ]}
                />
            </MemoryRouter>,
        )

        expect(screen.queryAllByRole('link', { current: 'page' })).toHaveLength(0)
    })
})
