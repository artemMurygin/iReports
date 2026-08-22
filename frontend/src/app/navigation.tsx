import {
    Banknote,
    CalendarCheck,
    CalendarClock,
    ChartNoAxesColumn,
    FileText,
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

export type NavLeaf = {
    label: string
    to: string
    icon: ReactNode
    end?: boolean
    disabled?: boolean
}

export type NavSection = {
    label: string
    icon: ReactNode
    items: NavLeaf[]
}

/**
 * App-wide navigation, matching the Pencil mockup's IA (design/sallary-first-iteration.pen,
 * `dRfe8`/`e1eFSf` "Sections" on desktop, `UiFMw`/`Z5IedD` "Nav" in the mobile drawer, `XXiyY`
 * "Bottom Nav" on mobile). There is NO dropdown anywhere: on desktop, each section
 * (Продажи/Аналитика/Зарплата) is a **plain link** to its first available page — the chevron
 * some of them show is decorative (matches node `eM1Bp`'s chevron override), and the actual
 * second level is the separate `Subnav` row below the Nav Bar (node `SHMkH`), populated with
 * the *current* section's own pages. "График работы" has no section/children, matching node
 * `US5To` (no chevron in the design either). The mobile drawer (`NavDrawer`) shows the same
 * sections as grouped, flat lists — no dropdown there either.
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
 * Lives in its own module (not inlined in `app/Header.tsx`) so both `app/Header.tsx` (desktop
 * Nav Bar + mobile drawer) and `app/BottomNav.tsx` (Pencil node `XXiyY`) can share one source
 * of truth for the IA — and so `app/Header.tsx` keeps exporting only its `Header` component
 * (`react-refresh/only-export-components` flags a component file that also exports plain
 * constants).
 */
export const SECTIONS: NavSection[] = [
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
            { label: 'Отчёт по зарплате', to: '/salaries', icon: <Receipt /> },
            // Фаза 5 плана "Закрытие месяца и начисления" (docs/payroll-closing-and-accrual):
            // список документов начисления закрытого месяца (`pages/SalaryAccruals`). Через
            // `SECTIONS` пункт автоматически попадает в Subnav десктопа (app/Header.tsx), в
            // мобильную шторку (`DRAWER_SECTIONS`) и, через раздел «Зарплата», в Bottom Nav.
            { label: 'Начисления', to: '/salary-accruals', icon: <Banknote /> },
            { label: 'Правила начисления', to: '/salaries/rules', icon: <Percent /> },
            { label: 'Отчётный период', to: '/salaries/period', icon: <CalendarCheck />, disabled: true },
        ],
    },
    // Раздел «Настройки» — служебная часть IA (нет в Pencil-макете, там только
    // Продажи/Аналитика/Зарплата/График). Пока в нём одна страница, поэтому Subnav для него
    // не рисуется (`app/Header.tsx` показывает вкладки только при items.length > 1), а
    // верхнеуровневая ссылка ведёт сразу на «Связи сотрудников».
    {
        label: 'Настройки',
        icon: <Settings />,
        items: [{ label: 'Связи сотрудников', to: '/settings/employee-identity', icon: <Link2 /> }],
    },
]

// Фаза 6 плана "График работы сотрудников" (docs/employee-work-schedule) реализует
// `pages/WorkSchedule` на `/work-schedule` (см. app/router.tsx) — пункт больше не плейсхолдер
// и включён (`disabled` снят), путь обновлён с прежнего '/schedule'.
export const STANDALONE_ITEM: NavLeaf = {
    label: 'График работы',
    to: '/work-schedule',
    icon: <CalendarClock />,
}

export const DRAWER_SECTIONS = [
    ...SECTIONS.map(({ label, items }) => ({ label, items })),
    { divider: true, items: [STANDALONE_ITEM] },
]

export const ALL_LEAVES: (NavLeaf & { section?: string })[] = [
    ...SECTIONS.flatMap((section) => section.items.map((item) => ({ ...item, section: section.label }))),
    STANDALONE_ITEM,
]

// Desktop Nav Bar's (and, since it's the same "one link per top-level section" shape,
// `app/BottomNav.tsx`'s) items: one flat, direct link per section (labels are the section
// names, e.g. "Продажи" — not the child page names), pointing at that section's first enabled
// page. The whole pill/nav item is disabled when the section has no enabled page yet. No
// trailing chevron on desktop — it read as a dropdown affordance even though nothing opens,
// so it's off for every item. Pure function of `SECTIONS`/`STANDALONE_ITEM` above (no props/
// hooks involved), so it's a module-level constant rather than recomputed per render.
export const TOP_LEVEL_NAV_ITEMS: NavLeaf[] = [
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

/**
 * Пункты нижней мобильной навигации (`app/BottomNav.tsx`). Макет Pencil
 * (design/sallary-first-iteration.pen, узел `XXiyY` `ERP/Mobile/Bottom Nav`, 390px) рассчитан
 * ровно на 5 равных слотов, последний из которых — «Ещё» (открывает `NavDrawer`). После
 * появления раздела «Настройки» верхнеуровневых пунктов стало 5, и шестой слот в ширину
 * не помещается: подписи в 11px («Настройки», «График работы») начали бы обрезаться.
 *
 * Решение: из нижней навигации исключается именно «Настройки» — редко используемый служебный
 * раздел, в отличие от четырёх ежедневных (Продажи/Аналитика/Зарплата/График работы), которые
 * и стоят в макете. На мобильном раздел остаётся доступен через «Ещё»: `DRAWER_SECTIONS`
 * строятся из `SECTIONS` целиком, поэтому в шторке он появляется автоматически. На десктопе
 * (`app/Header.tsx`) ограничения нет — там рендерится полный `TOP_LEVEL_NAV_ITEMS`.
 */
const BOTTOM_NAV_EXCLUDED_LABELS = ['Настройки']

export const BOTTOM_NAV_ITEMS: NavLeaf[] = TOP_LEVEL_NAV_ITEMS.filter(
    (item) => !BOTTOM_NAV_EXCLUDED_LABELS.includes(item.label),
)
