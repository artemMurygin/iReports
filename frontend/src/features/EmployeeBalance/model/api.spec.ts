import { describe, expect, it } from 'vitest'

import { api, BALANCE_SUMMARY_QUERY_KEY_PREFIX } from './api.ts'

// Регрессионный тест на рефетч списка «Взаиморасчёты» (pages/EmployeeSettlements, `/balance`)
// при смене фильтра отдела/поиска: TanStack Query решает, рефетчить ли, по равенству
// `queryKey` — если departmentId/search перестанут попадать в ключ, смена фильтра в UI
// перестанет запускать новый запрос, оставляя на экране старые данные. Тот же приём и та же
// причина, что у WORK_SCHEDULE_QUERY_KEY_PREFIX'а тест в pages/WorkSchedule/model/api.spec.ts.
describe('getBalanceSummary queryKey', () => {
    it('is prefixed by BALANCE_SUMMARY_QUERY_KEY_PREFIX', () => {
        const { queryKey } = api.getBalanceSummary('2026-08', {})
        expect(queryKey.slice(0, BALANCE_SUMMARY_QUERY_KEY_PREFIX.length)).toEqual([...BALANCE_SUMMARY_QUERY_KEY_PREFIX])
    })

    it('changes when departmentId changes ("Все отделы" -> конкретный отдел)', () => {
        const allDepartments = api.getBalanceSummary('2026-08', {}).queryKey
        const oneDepartment = api.getBalanceSummary('2026-08', { departmentId: 3 }).queryKey
        expect(allDepartments).not.toEqual(oneDepartment)
    })

    it('changes when the department filter switches between two different departments', () => {
        const departmentA = api.getBalanceSummary('2026-08', { departmentId: 3 }).queryKey
        const departmentB = api.getBalanceSummary('2026-08', { departmentId: 7 }).queryKey
        expect(departmentA).not.toEqual(departmentB)
    })

    it('changes when the search term changes', () => {
        const noSearch = api.getBalanceSummary('2026-08', {}).queryKey
        const withSearch = api.getBalanceSummary('2026-08', { search: 'Ковалёв' }).queryKey
        const otherSearch = api.getBalanceSummary('2026-08', { search: 'Соколова' }).queryKey
        expect(noSearch).not.toEqual(withSearch)
        expect(withSearch).not.toEqual(otherSearch)
    })

    it('stays stable for the same filter (no spurious refetch)', () => {
        const first = api.getBalanceSummary('2026-08', { departmentId: 3, search: 'Ковалёв' }).queryKey
        const second = api.getBalanceSummary('2026-08', { departmentId: 3, search: 'Ковалёв' }).queryKey
        expect(first).toEqual(second)
    })
})
