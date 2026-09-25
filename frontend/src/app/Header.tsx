import { Receipt, Wallet } from 'lucide-react'
import { useLocation } from 'react-router-dom'

import { useAuthStore, useCurrentUser, useLogout } from '@/features/Auth'
import { findMostSpecificNavMatch } from '@/shared/lib/nav.ts'
import { getEmployeeInitials } from '@/shared/lib/employeeInitials.ts'
import { Header as UiKitHeader, type ProfileMenuData } from '@/shared/ui-kit/organisms/Header'

import {
    ALL_LEAVES,
    DRAWER_SECTIONS,
    filterNavItemsByPermission,
    isTopLevelNavItemActive,
    SECTIONS,
    TOP_LEVEL_NAV_ITEMS,
} from './navigation.tsx'

// Dev-only байпас авторизации — то же условие и тот же смысл, что и в
// `features/Auth/model/useHasPermission.ts`/`app/route-guard/model/useRouteGuardState.ts`
// (`import.meta.env.DEV` инертен в `vite build`). Дублируется здесь (а не переиспользуется хук
// `useHasPermission` напрямую), потому что `filterNavItemsByPermission` (раздел 3 tasks.md) —
// чистая функция, которой нужен обычный колбэк `(permission) => boolean`, а не хук, вызываемый
// один раз на каждый пункт меню (переменное число пунктов на рендер нарушило бы Rules of Hooks).
const isAuthBypassed = import.meta.env.DEV && import.meta.env.VITE_AUTH_DISABLED === 'true'

export function Header() {
    const location = useLocation()
    // Общий с RouteGuard/useRouteGuardState кэш TanStack Query (тот же ключ auth-me, session.api.ts)
    // — Header не делает повторный сетевой запрос, здесь он уже прогрет к моменту, когда рендерится
    // Header (Layout монтируется только внутри RouteGuard, после подтверждения сессии).
    const { employee } = useCurrentUser()
    const { logout } = useLogout()
    // add-frontend-page-access-guard, раздел 6 tasks.md — тот же стор, что читает `useHasPermission`
    // (`features/Auth/model/authStore.ts`), наполняется `useCurrentUser` выше как побочный эффект.
    const permissions = useAuthStore((state) => state.permissions)
    const hasPermission = (permission: string | string[]): boolean =>
        isAuthBypassed || [permission].flat().some((code) => permissions.includes(code))
    const user = employee
        ? {
              name: `${employee.firstName} ${employee.lastName}`.trim(),
              initials: getEmployeeInitials(`${employee.firstName} ${employee.lastName}`),
          }
        : undefined

    // Профиль-меню (Pencil `FjbRC`/`X2GpSa`, десктоп-поповер + мобильная шторка) — открывается
    // из блока пользователя в шапке. «Выйти» доступно всегда; «Баланс»/«Моя зарплата» —
    // только когда известен id сотрудника (нужен для `/balance/employee/:id` и
    // `/salaries/employee/:employeeId`).
    const profileMenu: ProfileMenuData | undefined = employee
        ? {
              items: [
                  { label: 'Моя зарплата', icon: <Receipt />, to: `/salaries/employee/${employee.id}` },
                  { label: 'Баланс', icon: <Wallet />, to: `/balance/employee/${employee.id}` },
              ],
              onLogout: () => logout(),
          }
        : undefined

    // Pick the most specific match, not the first one in array order: with `end: false` (the
    // default), a shorter leaf like "Отчёт по зарплате" (`/salaries`) matches any nested path,
    // including "Правила начисления" (`/salaries/rules`) — comparing raw `find` order made the
    // mobile app-bar/drawer show the wrong title depending on which leaf happened to come first
    // in `SECTIONS`. `findMostSpecificNavMatch` compares `to.length` to pick the longest (most
    // specific) matching path regardless of declaration order.
    const activeLeaf = findMostSpecificNavMatch(ALL_LEAVES, location.pathname) ?? ALL_LEAVES[0]

    // Subnav: the current section's own pages as tabs (node `SHMkH`) — only when there's more
    // than one to switch between. Exactly one tab is marked `active`: the most specific match
    // among the section's own items (same `findMostSpecificNavMatch` used for `activeLeaf` above),
    // not each tab's own independent `NavLink` prefix match — otherwise e.g. "Отчёт по зарплате"
    // (`/salaries`, prefix match) and "Правила начисления" (`/salaries/rules`) would both light up
    // on `/salaries/rules`.
    const activeSection = SECTIONS.find((section) => section.label === activeLeaf.section)
    // add-frontend-page-access-guard, раздел 6 tasks.md — фильтрация по permission применяется к
    // источнику (`activeSection.items`) ДО вычисления `active`/до проверки "больше одной вкладки":
    // пункт без доступа (например, «Правила начисления» без `service-accounting:view`/
    // `shop-accounting:view`) не должен попасть ни в счётчик вкладок, ни тем более в сам Subnav.
    const visibleSectionItems = activeSection ? filterNavItemsByPermission(activeSection.items, hasPermission) : []
    const activeSubnavTab = findMostSpecificNavMatch(visibleSectionItems, location.pathname)
    const subnavTabs =
        visibleSectionItems.length > 1
            ? visibleSectionItems.map(({ label, to, end, disabled }) => ({
                  label,
                  to,
                  end,
                  disabled,
                  active: activeSubnavTab?.to === to,
              }))
            : undefined

    // Nav Bar pills: each pill is lit when the current path belongs to its *whole* section (any
    // of that section's child pages), not merely when it matches the single "primary" child page
    // the pill happens to link to — otherwise the pill goes dark the moment you navigate to a
    // sibling page in the same section (e.g. "Зарплата" on `/salary-accruals`, "Продажи" on
    // `/sales-plan`). Computed per render (depends on `location.pathname`), unlike the
    // pathname-independent `TOP_LEVEL_NAV_ITEMS` constant it's derived from.
    // add-frontend-page-access-guard, раздел 6 tasks.md — фильтрация по permission применяется к
    // источнику (`TOP_LEVEL_NAV_ITEMS`) ДО вычисления `active`: сегодня `requiredPermission` несёт
    // только standalone-пункт «Задачи» (у пилюль-разделов вроде «Зарплата» своего
    // `requiredPermission` нет — фильтрация их дочерних пунктов происходит отдельно, для Subnav/
    // Drawer, ниже).
    const navItems = filterNavItemsByPermission(TOP_LEVEL_NAV_ITEMS, hasPermission).map((item) => ({
        ...item,
        active: isTopLevelNavItemActive(item, location.pathname),
    }))

    // Mobile drawer: same "exactly one active item" mechanism as the desktop pills/tabs above,
    // rather than `NavDrawer`'s own independent `NavLink.isActive` per item (that used a plain
    // path-prefix match with no notion of "the other items", the same class of bug fixed for
    // `HeaderDesktop`/`Subnav`). The drawer lists every section's items flattened across the whole
    // app (not just the current section, unlike Subnav's tabs), so the *single* most specific
    // match across all of them is exactly `activeLeaf` computed above — an item is active only
    // when it's that same leaf (`to` is unique across `ALL_LEAVES`, so comparing it is enough).
    // add-frontend-page-access-guard, раздел 6 tasks.md — тот же `filterNavItemsByPermission`
    // применяется к каждой секции ДО вычисления `active`; секция, из которой фильтрация убрала все
    // пункты (например, «Зарплата» целиком для пользователя без единого permission её страниц),
    // целиком пропадает из Drawer, а не рендерится пустым заголовком без пунктов под ним (design.md
    // Decision "NavItem/TopLevelNavItem" — то же правило, что уже действует для `disabled`).
    const drawerSections = DRAWER_SECTIONS.map((section) => ({
        ...section,
        items: filterNavItemsByPermission(section.items, hasPermission).map((item) => ({
            ...item,
            active: item.to === activeLeaf.to,
        })),
    })).filter((section) => section.items.length > 0)

    return (
        <UiKitHeader
            navItems={navItems}
            subnavTabs={subnavTabs}
            drawerSections={drawerSections}
            user={user}
            mobile={{ section: activeLeaf.section, page: activeLeaf.label }}
            onLogout={() => logout()}
            profileMenu={profileMenu}
        />
    )
}
