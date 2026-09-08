import {
    BarChart3,
    CalendarCheck,
    CalendarClock,
    Download,
    FileText,
    Filter,
    LayoutDashboard,
    MoreVertical,
    Percent,
    Plus,
    Receipt,
    Search,
    Target,
    TrendingUp,
    Trash2,
    Wallet,
    X,
} from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { Header, HeaderDesktop } from '@/shared/ui-kit/organisms/Header'

const HEADER_NAV_ITEMS = [
    { label: 'Продажи', to: '/ui-kit-preview', icon: <TrendingUp />, end: true },
    { label: 'Аналитика', to: '/ui-kit-preview/analytics', icon: <BarChart3 /> },
    { label: 'Зарплата', to: '/ui-kit-preview/salary', icon: <Wallet /> },
    { label: 'График работы', to: '/ui-kit-preview/schedule', icon: <CalendarClock /> },
]

const HEADER_SUBNAV_TABS = [
    { label: 'Воронка продаж', to: '/ui-kit-preview', icon: <LayoutDashboard />, end: true },
    { label: 'План продаж', to: '/ui-kit-preview/plan', icon: <Target /> },
]

const HEADER_USER = { name: 'Артём Мурыгин', role: 'Руководитель', initials: 'АМ' }

const HEADER_MOBILE_ACTIONS = [
    { icon: <Search />, label: 'Поиск' },
    { icon: <MoreVertical />, label: 'Ещё' },
]

const HEADER_DRAWER_SECTIONS = [
    {
        label: 'Продажи',
        items: [
            { label: 'Воронка продаж', to: '/ui-kit-preview', icon: <LayoutDashboard />, end: true },
            { label: 'План продаж', to: '/ui-kit-preview/plan', icon: <Target /> },
        ],
    },
    {
        label: 'Аналитика',
        items: [{ label: 'Отчёт по услугам', to: '/ui-kit-preview/services-report', icon: <FileText /> }],
    },
    {
        label: 'Зарплата',
        items: [
            { label: 'Отчёт по зарплате', to: '/ui-kit-preview/salary-report', icon: <Receipt /> },
            { label: 'Правила начисления', to: '/ui-kit-preview/salary-rules', icon: <Percent /> },
            { label: 'Отчётный период', to: '/ui-kit-preview/salary-period', icon: <CalendarCheck /> },
        ],
    },
    {
        divider: true,
        items: [{ label: 'График работы', to: '/ui-kit-preview/schedule', icon: <CalendarClock /> }],
    },
]

/**
 * Dev-only visual sanity check for `shared/ui-kit`. Not linked from app navigation —
 * reachable directly at `/ui-kit-preview`. Extended by later UI Kit rollout phases as
 * more atoms/organisms land (see docs/ui-kit-new-header/plan-ui-kit-new-header.md).
 */
export function UiKitPreview() {
    return (
        <div className="min-h-screen bg-canvas pb-10">
            <section className="flex flex-col gap-3 pt-10">
                <h2 className="px-10 text-sm font-semibold text-ink">
                    HeaderDesktop — Pencil node dRfe8 (Nav Bar + Subnav)
                </h2>
                <div className="min-w-[1024px] overflow-x-auto">
                    <HeaderDesktop
                        navItems={HEADER_NAV_ITEMS}
                        subnavTabs={HEADER_SUBNAV_TABS}
                        user={HEADER_USER}
                        hasUnreadNotifications
                    />
                </div>
            </section>

            <section className="flex flex-col gap-3 pt-10">
                <h2 className="px-10 text-sm font-semibold text-ink">
                    Header — единая точка входа (десктоп ≥768px / мобильный &lt;768px, node kXibe + C19pWf Scrim).
                    Измените ширину окна браузера, чтобы увидеть переключение; на мобильной ширине нажмите на
                    иконку меню — должен показаться Scrim и выехать боковое меню (node UiFMw) со списком
                    разделов, закрывающееся по клику на подложку или на крестик.
                </h2>
                <div className="overflow-x-auto">
                    <Header
                        navItems={HEADER_NAV_ITEMS}
                        subnavTabs={HEADER_SUBNAV_TABS}
                        user={HEADER_USER}
                        hasUnreadNotifications
                        mobile={{
                            section: 'Продажи',
                            page: 'План продаж',
                            actions: HEADER_MOBILE_ACTIONS,
                        }}
                        drawerSections={HEADER_DRAWER_SECTIONS}
                    />
                </div>
            </section>

            <div className="mx-auto flex max-w-3xl flex-col gap-10 px-10 pt-10">
                <header>
                    <h1 className="font-display text-2xl font-semibold text-ink">UI Kit preview</h1>
                    <p className="mt-1 text-sm text-ink-muted">shared/ui-kit/atoms/Button — Pencil node AP9Nr</p>
                </header>

                <section className="flex flex-col gap-3">
                    <h2 className="text-sm font-semibold text-ink">Variants</h2>
                    <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-hairline bg-surface p-4">
                        <Button>
                            <Plus />
                            Изменить план
                        </Button>
                        <Button variant="secondary">
                            <Filter />
                            Фильтры
                        </Button>
                        <Button variant="ghost">
                            <X />
                            Снять выбор
                        </Button>
                        <Button variant="danger">
                            <Trash2 />
                            Удалить
                        </Button>
                        <Button disabled>Недоступно</Button>
                    </div>
                </section>

                <section className="flex flex-col gap-3">
                    <h2 className="text-sm font-semibold text-ink">Sizes</h2>
                    <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-hairline bg-surface p-4">
                        <Button size="sm">
                            <Plus />
                            Добавить строку
                        </Button>
                        <Button variant="secondary" size="sm">
                            <Download />
                            Выгрузить CSV
                        </Button>
                        <Button size="icon" aria-label="Добавить">
                            <Plus />
                        </Button>
                    </div>
                </section>
            </div>
        </div>
    )
}
