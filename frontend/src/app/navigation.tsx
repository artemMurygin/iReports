import {
    Banknote,
    CalendarCheck,
    CalendarClock,
    ChartNoAxesColumn,
    FileText,
    HandCoins,
    LayoutDashboard,
    Link2,
    Percent,
    Receipt,
    Settings,
    Target,
    TrendingUp,
    Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'

import { matchesAnyNavPath } from '@/shared/lib/nav.ts'
import type { NavDrawerSection, NavItem } from '@/shared/ui-kit/organisms/Header'

export type NavSection = {
    label: string
    icon: ReactNode
    items: NavItem[]
}

/**
 * App-wide navigation, matching the Pencil mockup's IA (design/sallary-first-iteration.pen,
 * `dRfe8`/`e1eFSf` "Sections" on desktop, `UiFMw`/`Z5IedD` "Nav" in the mobile drawer). There is
 * NO dropdown anywhere: on desktop, each section
 * (Продажи/Зарплата/Аналитика/Настройки) is a **plain link** to its first available page, and the
 * actual second level is the separate `Subnav` row below the Nav Bar (node `SHMkH`), populated
 * with the *current* section's own pages. The mockup draws a decorative trailing chevron on three
 * of the four section instances (node `eM1Bp`'s chevron override) to hint "has sub-pages, see the
 * Subnav row below" — the shipped Nav Bar renders no chevron on any item instead (see
 * `HeaderDesktop.tsx`'s doc comment for why), so `NavItem` (`shared/ui-kit/organisms/Header`)
 * carries no `chevron` field. "График работы" has no section/children, matching node `US5To`
 * (no chevron in the design either). The mobile drawer (`NavDrawer`) shows the same sections as
 * grouped, flat lists — no dropdown there either.
 *
 * The top-level order — Продажи, Зарплата, График работы, Аналитика, Настройки
 * (docs/header-navigation-fixes/prd-header-navigation-fixes.md) — is declared once, by
 * `NAV_ENTRIES` below, and both the desktop Nav Bar (`TOP_LEVEL_NAV_ITEMS`) and the mobile drawer
 * (`DRAWER_SECTIONS`) derive their item order from it, rather than each assembling its own order.
 *
 * `disabled: true` renders a muted, non-interactive placeholder for pages not shipped yet
 * (matches the previous plain header's treatment of "Отчёт по зарплатам") — most of this IA is
 * still placeholder until those pages exist; "Воронка продаж", "Услуги" (formerly flat
 * "Аналитика услуг", now nested under "Аналитика" per the updated design), "План продаж"
 * (view-only, see docs/sales-plan-view-page/plan-sales-plan-view-page.md), "Правила
 * начисления" (`/salaries/rules` — the schema LIST page, `pages/SalaryRuleList`, see
 * docs/salary-schema-list-ui; schema creation moved to the child route `/salaries/rules/new`,
 * `pages/SalaryRules`, still linked from there via its "Создать схему" actions — see
 * docs/salary-schema-creation-ui/plan-salary-schema-creation-ui.md, Фаза 2), "Связи
 * сотрудников" (единственная страница нового раздела «Настройки» — сопоставление сотрудников
 * между ERP-системами, `/settings/employee-identity`) and "График работы" (calendar view only,
 * `/work-schedule` — `pages/WorkSchedule`, see docs/employee-work-schedule, Фаза 6) are real
 * today.
 *
 * Lives in its own module (not inlined in `app/Header.tsx`) so `app/Header.tsx` keeps exporting
 * only its `Header` component (`react-refresh/only-export-components` flags a component file
 * that also exports plain constants).
 */

// Фаза 6 плана "График работы сотрудников" (docs/employee-work-schedule) реализует
// `pages/WorkSchedule` на `/work-schedule` (см. app/router.tsx) — пункт больше не плейсхолдер
// и включён (`disabled` снят), путь обновлён с прежнего '/schedule'. Единственный пункт верхнего
// меню без своего раздела/Subnav — отсюда и отдельная декларация вместо `NavSection.items`.
export const STANDALONE_ITEM: NavItem = {
    label: 'График работы',
    to: '/work-schedule',
    icon: <CalendarClock />,
}

/**
 * One entry of the top-level nav: either a `section` (own Subnav row + several child pages) or a
 * lone `standalone` item ("График работы" — no children, no Subnav). A discriminated union rather
 * than two parallel arrays so a single ordered list (`NAV_ENTRIES` below) can carry both kinds.
 */
type NavEntry = { kind: 'section'; section: NavSection } | { kind: 'standalone'; item: NavItem }

/**
 * The single declarative source of the top-level nav's order — Продажи, Зарплата, График работы,
 * Аналитика, Настройки (docs/header-navigation-fixes/prd-header-navigation-fixes.md) — for both
 * desktop (`TOP_LEVEL_NAV_ITEMS`) and the mobile drawer (`DRAWER_SECTIONS`): both are `.map`ped
 * from this one array in this one order below, instead of each rebuilding its own order (desktop
 * previously mapped a `SECTIONS` literal and separately concatenated `STANDALONE_ITEM` at the end,
 * which is exactly what let the two surfaces drift out of sync with each other).
 */
const NAV_ENTRIES: NavEntry[] = [
    {
        kind: 'section',
        section: {
            label: 'Продажи',
            icon: <TrendingUp />,
            items: [
                { label: 'Воронка продаж', to: '/', icon: <LayoutDashboard />, end: true },
                { label: 'План продаж', to: '/sales-plan', icon: <Target /> },
            ],
        },
    },
    {
        kind: 'section',
        section: {
            label: 'Зарплата',
            icon: <Wallet />,
            items: [
                // `pages/SalaryReportV2` (Pencil: design/sallary-first-iteration.pen, `wLtzp`/`b63e8p`/
                // `wVa5g`/`z5BwMk`) — исходный дизайн этой страницы (`pages/SalaryReport`, отдельный
                // роут `/salaries-v2` рядом со старым для сравнения) удалён, это единственная страница
                // отчёта по зарплате.
                { label: 'Отчёт по зарплате', to: '/salaries', icon: <Receipt /> },
                // Фаза 5 плана "Закрытие месяца и начисления" (docs/payroll-closing-and-accrual):
                // список документов начисления закрытого месяца (`pages/SalaryAccruals`). Через
                // `NAV_ENTRIES` пункт автоматически попадает в Subnav десктопа (app/Header.tsx) и в
                // мобильную шторку (`DRAWER_SECTIONS`).
                { label: 'Начисления', to: '/salary-accruals', icon: <Banknote /> },
                // docs/employee-settlements-page-redesign, Фаза 3 (PRD «Критерии готовности»:
                // "Пункт меню «Зарплата» ведёт на новую страницу «Взаиморасчёты с сотрудниками»
                // вместо «Выплата»") — заменяет прежние два пункта: «Балансы» (`/balance/department`,
                // сводка ТОЛЬКО по выбранному отделу, `pages/DepartmentBalances`) и «Выплата»
                // (`/payout` — роут, страница `pages/Payout` и фича `features/Payout` удалены Фазой 6
                // того же плана: создание выплаты переехало в drawer «Добавить расход» страницы
                // баланса сотрудника, `features/EmployeeBalance`). Новая страница
                // `pages/EmployeeSettlements` покрывает обе роли: сквозной список балансов всех
                // сотрудников с точкой входа на баланс одного (`/balance/employee/:id`).
                { label: 'Взаиморасчёты', to: '/balance', icon: <HandCoins /> },
                { label: 'Правила начисления', to: '/salaries/rules', icon: <Percent /> },
                { label: 'Отчётный период', to: '/salaries/period', icon: <CalendarCheck />, disabled: true },
            ],
        },
    },
    { kind: 'standalone', item: STANDALONE_ITEM },
    {
        kind: 'section',
        section: {
            label: 'Аналитика',
            icon: <ChartNoAxesColumn />,
            items: [{ label: 'Услуги', to: '/services', icon: <FileText /> }],
        },
    },
    // Раздел «Настройки» — служебная часть IA (нет в Pencil-макете, там только
    // Продажи/Аналитика/Зарплата/График). Пока в нём одна страница, поэтому Subnav для него
    // не рисуется (`app/Header.tsx` показывает вкладки только при items.length > 1), а
    // верхнеуровневая ссылка ведёт сразу на «Связи сотрудников».
    {
        kind: 'section',
        section: {
            label: 'Настройки',
            icon: <Settings />,
            items: [{ label: 'Связи сотрудников', to: '/settings/employee-identity', icon: <Link2 /> }],
        },
    },
]

export const SECTIONS: NavSection[] = NAV_ENTRIES.filter(
    (entry): entry is Extract<NavEntry, { kind: 'section' }> => entry.kind === 'section',
).map((entry) => entry.section)

export const DRAWER_SECTIONS: NavDrawerSection[] = NAV_ENTRIES.map((entry) =>
    entry.kind === 'section'
        ? { label: entry.section.label, items: entry.section.items }
        : { divider: true, items: [entry.item] },
)

export const ALL_LEAVES: (NavItem & { section?: string })[] = NAV_ENTRIES.flatMap((entry) =>
    entry.kind === 'section'
        ? entry.section.items.map((item) => ({ ...item, section: entry.section.label }))
        : [entry.item],
)

export type TopLevelNavItem = NavItem & {
    /**
     * Every path that belongs to this item's section — used to decide whether the whole section
     * is active for the current pathname, not just this item's own `to` (which is only the
     * section's first enabled/"primary" child page, the link target when the item is clicked).
     * For "Настройки" (item.to is the section's own only page) that's a one-item list; for the
     * standalone "График работы" (no section) it's just itself.
     */
    matchPaths: NavItem[]
}

// Desktop Nav Bar's items: one flat, direct link per section (labels are the section names,
// e.g. "Продажи" — not the child page names), pointing at that section's first enabled page.
// The whole pill/nav item is disabled when the section has no enabled page yet. No trailing
// chevron on desktop — it read as a dropdown affordance even though nothing opens, so it's off
// for every item. Pure function of `NAV_ENTRIES` above (no props/hooks involved), so it's a
// module-level constant rather than recomputed per render.
export const TOP_LEVEL_NAV_ITEMS: TopLevelNavItem[] = NAV_ENTRIES.map((entry) => {
    if (entry.kind === 'standalone') {
        return { ...entry.item, matchPaths: [entry.item] }
    }
    const { section } = entry
    const primary = section.items.find((item) => !item.disabled)
    return {
        label: section.label,
        icon: section.icon,
        to: primary?.to ?? section.items[0].to,
        end: primary?.end,
        disabled: !primary,
        matchPaths: section.items,
    }
})

/**
 * Whether `pathname` belongs to `item`'s section as a whole (any of its child pages), not just
 * `item`'s own `to` — the fix for the top-level nav pill going dark on e.g. `/salary-accruals`
 * or `/sales-plan` even though those pages belong to the "Зарплата"/"Продажи" section that's
 * still current. Disabled items count too: they're still part of the section, they just aren't
 * a clickable link (a stray/manual navigation to a disabled page's URL should still keep the
 * section's own nav pill lit).
 */
export function isTopLevelNavItemActive(item: TopLevelNavItem, pathname: string): boolean {
    return matchesAnyNavPath(item.matchPaths, pathname)
}
