import { describe, expect, it, vi } from 'vitest'

import { ALL_LEAVES, filterNavItemsByPermission } from './navigation.tsx'
import type { RouteHandle } from './route-guard'
import { router } from './router.tsx'

/**
 * add-frontend-page-access-guard, раздел 3 tasks.md; design.md "NavItem/TopLevelNavItem:
 * requiredPermission?: string | string[] как данные, фильтрация — в Header.tsx" —
 * `filterNavItemsByPermission` — чистая функция без рендера и без доступа к `authStore`
 * напрямую: она принимает уже готовый предикат (`hasPermission`, на практике —
 * `useHasPermission` из `features/Auth`) и решает только "оставить пункт или нет", не зная
 * ничего о Zustand/сессии. Единственный реальный вызывающий — `app/Header.tsx` (задача 6);
 * здесь функция тестируется изолированно, на плоских фикстурах, а не на `NAV_ENTRIES`, чтобы
 * тест не зависел от состава реального меню.
 */
describe('filterNavItemsByPermission', () => {
    it('always keeps an item without requiredPermission, regardless of hasPermission', () => {
        const items: { label: string; requiredPermission?: string | string[] }[] = [{ label: 'Без ограничений' }]
        const hasPermission = vi.fn(() => false)

        expect(filterNavItemsByPermission(items, hasPermission)).toEqual(items)
        expect(hasPermission).not.toHaveBeenCalled()
    })

    it('excludes an item whose requiredPermission hasPermission rejects', () => {
        const items = [{ label: 'Роли и права', requiredPermission: 'roles:manage' }]
        const hasPermission = vi.fn(() => false)

        expect(filterNavItemsByPermission(items, hasPermission)).toEqual([])
        expect(hasPermission).toHaveBeenCalledWith('roles:manage')
    })

    it('includes an item whose requiredPermission hasPermission accepts', () => {
        const items = [{ label: 'Задачи', requiredPermission: 'tasks:view' }]
        const hasPermission = vi.fn(() => true)

        expect(filterNavItemsByPermission(items, hasPermission)).toEqual(items)
    })

    it('accepts an array requiredPermission and forwards it to hasPermission as-is (OR-семантика делегирована колбэку)', () => {
        const items = [
            {
                label: 'Начисления',
                requiredPermission: ['service-accounting:view_accrual', 'shop-accounting:view_accrual'],
            },
        ]
        const hasPermission = vi.fn(() => true)

        expect(filterNavItemsByPermission(items, hasPermission)).toEqual(items)
        expect(hasPermission).toHaveBeenCalledWith([
            'service-accounting:view_accrual',
            'shop-accounting:view_accrual',
        ])
    })

    it('preserves the relative order of the remaining items', () => {
        const items = [
            { label: 'Воронка продаж' },
            { label: 'Роли и права', requiredPermission: 'roles:manage' },
            { label: 'Задачи', requiredPermission: 'tasks:view' },
            { label: 'График работы' },
        ]
        const hasPermission = (permission: string | string[]) => permission !== 'roles:manage'

        expect(filterNavItemsByPermission(items, hasPermission).map((item) => item.label)).toEqual([
            'Воронка продаж',
            'Задачи',
            'График работы',
        ])
    })
})

/**
 * add-frontend-page-access-guard, раздел 5 tasks.md — защита от рассинхронизации меню и роутинга:
 * `NAV_ENTRIES` (через `ALL_LEAVES`, `app/navigation.tsx`) и `router.tsx` (раздел 4 tasks.md)
 * задают `requiredPermission` независимо, двумя литералами в двух файлах — ничто не мешает им
 * разъехаться при будущей правке одного без другого. Сравнение по множеству элементов
 * (`normalizePermission` + сортировка), а не строгое равенство массивов, — таблица задачи 4.1
 * describes OR-семантику как факт "какой-то из кодов", порядок элементов в литерале значения не
 * несёт.
 */
function normalizePermission(permission: string | string[] | undefined): string[] {
    return [permission]
        .flat()
        .filter((code): code is string => code !== undefined)
        .sort()
}

function findRouteHandle(path: string): RouteHandle | undefined {
    const root = router.routes[0]
    const route = root.children?.find((child) => child.path === path)

    return route?.handle as RouteHandle | undefined
}

describe('NAV_ENTRIES requiredPermission синхронизирован с router.tsx (add-frontend-page-access-guard, раздел 5 tasks.md)', () => {
    it.each([
        ['/salary-accruals', 'salary-accruals'],
        ['/balance', 'balance'],
        ['/tasks', 'tasks'],
        ['/salaries', 'salaries'],
        ['/salaries/rules', 'salaries/rules'],
    ] as const)('%s: requiredPermission пункта меню совпадает с handle.requiredPermission роута', (navTo, routerPath) => {
        const navItem = ALL_LEAVES.find((item) => item.to === navTo)
        const routeHandle = findRouteHandle(routerPath)

        expect(navItem).toBeDefined()
        expect(normalizePermission(navItem?.requiredPermission)).toEqual(normalizePermission(routeHandle?.requiredPermission))
    })
})
