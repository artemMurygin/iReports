import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { useDepartments } from '@/features/TargetDirectory'

import { api } from './api.ts'
import { parseHighlightedEmployeeId } from './employeeHighlight.ts'
import { formatFullDateLabel, formatMonthLabel, getCurrentMonthIso, getTodayIso, isValidMonth } from './format.ts'
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
 *
 * `month`/`highlightedEmployeeId` читают query-параметры `?month=&employeeId=` один раз при
 * монтировании (`useState`-инициализатор, тот же приём, что и у `todayIso`) — это вход со стороны
 * мобильного экрана «Отдел сегодня» (план, Фаза 9: «Переход с карточки сотрудника на его график»,
 * см. `pages/WorkScheduleToday/model/employeeScheduleLink.ts`), а не состояние, которому нужно
 * следить за URL после открытия страницы: руководитель может свободно листать месяцы дальше, не
 * дёргая назад к тому, с которого пришёл переход.
 */
export function useWorkSchedulePage() {
    const [searchParams] = useSearchParams()
    const [month, setMonth] = useState<string>(() => {
        const fromQuery = searchParams.get('month')
        return fromQuery && isValidMonth(fromQuery) ? fromQuery : getCurrentMonthIso()
    })
    const [highlightedEmployeeId] = useState<number | null>(() =>
        parseHighlightedEmployeeId(searchParams.get('employeeId')),
    )
    // `undefined` — фильтр ещё не тронут руководителем (дефолт — отдел «Розница», как только
    // подгрузится справочник), `null` — руководитель осознанно выбрал «все» (см. `effectiveDepartmentId`
    // ниже); два состояния не могут делить одно значение `null`, иначе выбор «все» после дефолта
    // был бы неотличим от «дефолт ещё не применён» и тут же откатывался обратно на «Розница».
    const [departmentId, setDepartmentId] = useState<number | null | undefined>(undefined)
    const [tab, setTab] = useState<WorkScheduleTab>('CALENDAR')
    const [todayIso] = useState<string>(getTodayIso)

    const departmentsQuery = useDepartments()
    const departments = departmentsQuery.data ?? []

    // Дефолт фильтра отдела — «Розница», выведенный, а не выставленный императивно через
    // `setState` в эффекте (react-hooks/set-state-in-effect): пока справочник не загружен, id ещё
    // нет и `effectiveDepartmentId` останется `null` («все») до следующего рендера с данными —
    // одним и тем же способом что для первого рендера, что после того, как отдел найдётся.
    const defaultDepartmentId = departments.find((department) => department.name === 'Розница')?.id ?? null
    const effectiveDepartmentId = departmentId === undefined ? defaultDepartmentId : departmentId

    // placeholderData: keepPreviousData — переключение месяца/отдела не схлопывает уже
    // отрисованную таблицу в спиннер (см. frontend/CLAUDE.md, "isInitialLoad / isRefreshing").
    const {
        data,
        isFetching,
        error: queryError,
        dataUpdatedAt,
    } = useQuery({ ...api.getMonthlySchedule(month, effectiveDepartmentId), placeholderData: keepPreviousData })

    const employees = data?.employees ?? []
    const days = useMemo(() => buildMonthDays(month, todayIso), [month, todayIso])

    const isInitialLoad = isFetching && data === undefined
    const isRefreshing = isFetching && !isInitialLoad

    return {
        month,
        setMonth,
        departmentId: effectiveDepartmentId,
        setDepartmentId,
        tab,
        setTab,
        highlightedEmployeeId,
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
