import { describe, expect, it } from 'vitest'

import type { RouteHandle } from './route-guard'
import { router } from './router.tsx'

/**
 * add-frontend-page-access-guard, раздел 4 tasks.md; architecture.md "Затронутые роуты
 * (`app/router.tsx`)" — проверяет, что `handle.requiredPermission` каждого перечисленного
 * там роута дословно совпадает с таблицей (аудит backend `@RequirePermissions`, см.
 * design.md Decisions), и что уже защищённые до этого change роуты (`settings/roles`,
 * `work-schedule`, `work-schedule/today`) не изменились. Роуты в `router.tsx` — плоский
 * список детей одного layout-роута `/` (без вложенных путей), поэтому достаточно найти
 * запись по `path` среди `children` корневого роута — тот же путь, что `useMatches()`
 * проходит в `RouteGuard.tsx`.
 */
function findRouteHandle(path: string): RouteHandle | undefined {
    const root = router.routes[0]
    const route = root.children?.find((child) => child.path === path)

    return route?.handle as RouteHandle | undefined
}

describe('router.tsx requiredPermission (add-frontend-page-access-guard, раздел 4 tasks.md)', () => {
    it.each([
        ['salary-accruals', ['service-accounting:view_accrual', 'shop-accounting:view_accrual']],
        ['salary-accruals/:id', ['service-accounting:view_accrual', 'shop-accounting:view_accrual']],
        ['balance', 'employee-balance:view_all'],
        ['balance/employee/:id', 'employee-balance:view_all'],
        ['tasks', 'tasks:view'],
        [
            'salaries',
            ['service-accounting:view_all_salary_report', 'shop-accounting:view_all_salary_report'],
        ],
        [
            'salaries/employee/:employeeId',
            ['service-accounting:view_all_salary_report', 'shop-accounting:view_all_salary_report'],
        ],
        ['salaries/rules', ['service-accounting:view', 'shop-accounting:view']],
        ['salaries/rules/new', ['service-accounting:view', 'shop-accounting:view']],
        ['salaries/rules/:direction/:id', ['service-accounting:view', 'shop-accounting:view']],
    ] as const)('%s -> requiredPermission %j', (path, expected) => {
        expect(findRouteHandle(path)?.requiredPermission).toEqual(expected)
    })

    it('не меняет уже существующий handle.requiredPermission у settings/roles / work-schedule / work-schedule/today', () => {
        expect(findRouteHandle('settings/roles')?.requiredPermission).toEqual('roles:manage')
        expect(findRouteHandle('work-schedule')?.requiredPermission).toEqual('work-schedule:view')
        expect(findRouteHandle('work-schedule/today')?.requiredPermission).toEqual('work-schedule:view')
    })
})
