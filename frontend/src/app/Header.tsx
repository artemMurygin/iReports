import {
    CalendarCheck,
    CalendarClock,
    ChartNoAxesColumn,
    FileText,
    LayoutDashboard,
    Percent,
    Receipt,
    Target,
    TrendingUp,
    Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { matchPath, useLocation } from 'react-router-dom'

import { Header as UiKitHeader } from '@/shared/ui-kit/organisms/Header'

type NavLeaf = {
    label: string
    to: string
    icon: ReactNode
    end?: boolean
    disabled?: boolean
}

type NavSection = {
    label: string
    icon: ReactNode
    items: NavLeaf[]
}

/**
 * App-wide navigation, matching the Pencil mockup's IA (design/sallary-first-iteration.pen,
 * `dRfe8`/`e1eFSf` "Sections" on desktop, `UiFMw`/`Z5IedD` "Nav" in the mobile drawer). There is
 * NO dropdown anywhere: on desktop, each section (Продажи/Аналитика/Зарплата) is a **plain
 * link** to its first available page — the chevron some of them show is decorative (matches
 * node `eM1Bp`'s chevron override), and the actual second level is the separate `Subnav` row
 * below the Nav Bar (node `SHMkH`), populated with the *current* section's own pages. "График
 * работы" has no section/children, matching node `US5To` (no chevron in the design either). The
 * mobile drawer (`NavDrawer`) shows the same sections as grouped, flat lists — no dropdown there
 * either.
 *
 * `disabled: true` renders a muted, non-interactive placeholder for pages not shipped yet
 * (matches the previous plain header's treatment of "Отчёт по зарплатам") — most of this IA is
 * still placeholder until those pages exist; only "Воронка продаж", "Услуги" (formerly flat
 * "Аналитика услуг", now nested under "Аналитика" per the updated design), and "План продаж"
 * (view-only, see docs/sales-plan-view-page/plan-sales-plan-view-page.md) are real today.
 *
 * No `user`/`hasUnreadNotifications` is passed to `UiKitHeader` below — there is no real
 * signed-in-user or notifications data source in the app yet (only Bitrix24 admin-check
 * exists on the backend, no user profile endpoint), so those UI slots stay hidden rather than
 * showing a fabricated identity. Wire them up once that lands.
 */
const SECTIONS: NavSection[] = [
    {
        label: 'Продажи',
        icon: <TrendingUp />,
        items: [
            { label: 'Воронка продаж', to: '/', icon: <LayoutDashboard />, end: true },
            { label: 'План продаж', to: '/sales-plan', icon: <Target /> },
        ],
    },
    {
        label: 'Аналитика',
        icon: <ChartNoAxesColumn />,
        items: [{ label: 'Услуги', to: '/services', icon: <FileText /> }],
    },
    {
        label: 'Зарплата',
        icon: <Wallet />,
        items: [
            { label: 'Отчёт по зарплате', to: '/salaries', icon: <Receipt />, disabled: true },
            { label: 'Правила начисления', to: '/salaries/rules', icon: <Percent />, disabled: true },
            { label: 'Отчётный период', to: '/salaries/period', icon: <CalendarCheck />, disabled: true },
        ],
    },
]

const STANDALONE_ITEM: NavLeaf = { label: 'График работы', to: '/schedule', icon: <CalendarClock />, disabled: true }

const DRAWER_SECTIONS = [
    ...SECTIONS.map(({ label, items }) => ({ label, items })),
    { divider: true, items: [STANDALONE_ITEM] },
]

const ALL_LEAVES: (NavLeaf & { section?: string })[] = [
    ...SECTIONS.flatMap((section) => section.items.map((item) => ({ ...item, section: section.label }))),
    STANDALONE_ITEM,
]

export function Header() {
    const location = useLocation()

    const activeLeaf =
        ALL_LEAVES.find((item) => matchPath({ path: item.to, end: item.end ?? false }, location.pathname)) ??
        ALL_LEAVES[0]

    // Desktop Nav Bar: one flat, direct link per section (labels are the section names, e.g.
    // "Продажи" — not the child page names), pointing at that section's first enabled page.
    // The whole pill is disabled when the section has no enabled page yet. No trailing chevron —
    // it read as a dropdown affordance even though nothing opens, so it's off for every item.
    const navItems: NavLeaf[] = [
        ...SECTIONS.map((section) => {
            const primary = section.items.find((item) => !item.disabled)
            return {
                label: section.label,
                icon: section.icon,
                to: primary?.to ?? section.items[0].to,
                end: primary?.end,
                disabled: !primary,
            }
        }),
        STANDALONE_ITEM,
    ]

    // Subnav: the current section's own pages as tabs (node `SHMkH`) — only when there's more
    // than one to switch between.
    const activeSection = SECTIONS.find((section) => section.label === activeLeaf.section)
    const subnavTabs =
        activeSection && activeSection.items.length > 1
            ? activeSection.items.map(({ label, to, end, disabled }) => ({ label, to, end, disabled }))
            : undefined

    return (
        <UiKitHeader
            navItems={navItems}
            subnavTabs={subnavTabs}
            drawerSections={DRAWER_SECTIONS}
            mobile={{ section: activeLeaf.section, page: activeLeaf.label }}
        />
    )
}
