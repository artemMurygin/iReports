import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { useDepartments } from '@/features/TargetDirectory'

import { api } from './api.ts'
import { formatFullDateLabel, formatMonthLabel, getCurrentMonthIso, getTodayIso } from './format.ts'
import { buildMonthDays } from './scheduleDays.ts'
import type { WorkScheduleTab } from './tabs.ts'

/**
 * Владеет всем состоянием страницы «График работы»: выбранный месяц/отдел/вкладка, запрос месяца
 * (`useWorkSchedulePage` — плоский объект по тому же соглашению, что и `useSalesPlanPage`/
 * `useServicesAnalytics`, см. frontend/CLAUDE.md), справочник отделов для фильтра и список
 * календарных дней месяца (`buildMonthDays`, общий для шапки/строк/подвала таблицы).
 *
 * `todayIso` вычисляется один раз при монтировании (`useState` с инициализатором, а не
 * пересчитывается на каждый рендер) — «сегодня» не должно скакать в рамках одной открытой
 * страницы, а полночь посреди сессии — не тот сценарий, ради которого стоит городить таймер.
 *
 * `tab` — свой независимый `useState`, а не третий параметр запроса: вкладки «Календарь»/«Роли»
 * рендерят одни и те же `employees`/`days` месяца (план, Фаза 8 — «данные берутся из того же GET
 * /v1/work-schedule … отдельный запрос не нужен»), поэтому переключение вкладки не должно
 * перезапускать `useQuery` и, соответственно, не может само по себе сбросить `month`/`departmentId`.
 */
export function useWorkSchedulePage() {
    const [month, setMonth] = useState<string>(getCurrentMonthIso)
    const [departmentId, setDepartmentId] = useState<number | null>(null)
    const [tab, setTab] = useState<WorkScheduleTab>('CALENDAR')
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
        tab,
        setTab,
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
