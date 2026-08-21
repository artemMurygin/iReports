import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { useDepartments } from '@/features/TargetDirectory'

import { api } from './api.ts'
import { formatFullDateLabel, formatMonthLabel, getCurrentMonthIso, getTodayIso } from './format.ts'
import { buildMonthDays } from './scheduleDays.ts'

/**
 * Владеет всем состоянием страницы «График работы»: выбранный месяц/отдел, запрос месяца
 * (`useWorkSchedulePage` — плоский объект по тому же соглашению, что и `useSalesPlanPage`/
 * `useServicesAnalytics`, см. frontend/CLAUDE.md), справочник отделов для фильтра и список
 * календарных дней месяца (`buildMonthDays`, общий для шапки/строк/подвала таблицы).
 *
 * `todayIso` вычисляется один раз при монтировании (`useState` с инициализатором, а не
 * пересчитывается на каждый рендер) — «сегодня» не должно скакать в рамках одной открытой
 * страницы, а полночь посреди сессии — не тот сценарий, ради которого стоит городить таймер.
 */
export function useWorkSchedulePage() {
    const [month, setMonth] = useState<string>(getCurrentMonthIso)
    const [departmentId, setDepartmentId] = useState<number | null>(null)
    const [todayIso] = useState<string>(getTodayIso)

    const departmentsQuery = useDepartments()
    const departments = departmentsQuery.data ?? []

    // placeholderData: keepPreviousData — переключение месяца/отдела не схлопывает уже
    // отрисованную таблицу в спиннер (см. frontend/CLAUDE.md, "isInitialLoad / isRefreshing").
    const {
        data,
        isFetching,
        error: queryError,
        dataUpdatedAt,
    } = useQuery({ ...api.getMonthlySchedule(month, departmentId), placeholderData: keepPreviousData })

    const employees = data?.employees ?? []
    const days = useMemo(() => buildMonthDays(month, todayIso), [month, todayIso])

    const isInitialLoad = isFetching && data === undefined
    const isRefreshing = isFetching && !isInitialLoad

    return {
        month,
        setMonth,
        departmentId,
        setDepartmentId,
        departments,
        isDepartmentsLoading: departmentsQuery.isLoading,
        days,
        employees,
        dayAggregates: data?.days ?? [],
        totalHours: data?.totalHours ?? 0,
        hasData: employees.length > 0,
        periodLabel: formatMonthLabel(month),
        todayLabel: formatFullDateLabel(todayIso),
        isInitialLoad,
        isRefreshing,
        dataVersion: dataUpdatedAt,
        error: queryError?.message ?? null,
    }
}
