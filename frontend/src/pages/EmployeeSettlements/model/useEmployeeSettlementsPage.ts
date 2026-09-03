import { useCallback, useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { api } from '@/features/EmployeeBalance'
import { DEFAULT_PERIOD } from '@/features/SalesPlan'
import { useDepartments } from '@/features/TargetDirectory'
import { useDebounce } from '@/shared/hooks/useDebounce.ts'
import { formatShortDateTime } from '@/shared/lib/format.ts'

const SEARCH_DEBOUNCE_MS = 400

/**
 * Состояние `pages/EmployeeSettlements` (`/balance`, docs/employee-settlements-page-redesign,
 * Фаза 3 — десктоп; Node `IFJW2`) — эволюция `useDepartmentBalancesPage` (см. history) под
 * сквозной, не завязанный на выбор отдела список: в отличие от прежней страницы отдел здесь
 * НЕ обязателен для показа данных — `departmentId: null` значит «Все отделы» и агрегирует по
 * всей компании, поэтому запрос не гейтится `enabled`. По умолчанию (пока ссылка не содержит
 * `?departmentId=`) выбран отдел «Розница» — тот же паттерн, что и в
 * `pages/WorkSchedule/model/useWorkSchedulePage.ts`: применяется один раз при первом монтировании
 * страницы через `defaultAppliedRef`, чтобы явный выбор пользователя (в т.ч. «Все отделы») не
 * затирался обратно на дефолт при последующих ререндерах.
 *
 * `departmentId` — в query-строке (`?departmentId=`), тот же приём, что был у
 * `useDepartmentBalancesPage`, чтобы фильтр отдела переживал обновление страницы и был
 * шарибельной ссылкой. `search` — ЛОКАЛЬНЫЙ стейт (не URL, по заданию Фазы 3), с debounce
 * (`useDebounce`, тот же приём, что `pages/ServicesReport/model/useFilters.tsx`) — поиск бьёт
 * в бэкенд (`GetBalanceSummaryService` фильтрует ДО расчёта KPI), поэтому не должен уходить
 * запросом на каждое нажатие клавиши.
 *
 * `period` не выбирается пользователем — сводка от периода не зависит (см. WHY в
 * `GetBalanceSummaryService`/`balanceSummaryResponseSchema`), `:period` в пути присутствует
 * только форматом валидации, поэтому здесь всегда `DEFAULT_PERIOD` и нет `setPeriod`/UI для
 * него, в отличие от прежней страницы.
 */
export function useEmployeeSettlementsPage() {
    const [searchParams, setSearchParams] = useSearchParams()

    const rawDepartmentId = searchParams.get('departmentId')
    const departmentId = rawDepartmentId !== null && rawDepartmentId !== '' ? Number(rawDepartmentId) : null

    // useCallback (не обычная функция) — стабильная identity нужна, чтобы её можно было
    // безопасно включить в deps эффекта дефолта «Розница» ниже, не вызывая его на каждый рендер.
    const setDepartmentId = useCallback(
        (next: number | null) => {
            setSearchParams(
                (prev) => {
                    const params = new URLSearchParams(prev)
                    if (next === null) params.delete('departmentId')
                    else params.set('departmentId', String(next))
                    return params
                },
                { replace: true },
            )
        },
        [setSearchParams],
    )

    const [search, setSearch] = useState('')
    const { debouncedValue: debouncedSearch, isDebouncing } = useDebounce(search, SEARCH_DEBOUNCE_MS)
    const trimmedSearch = debouncedSearch.trim()

    const departments = useDepartments()

    // Дефолт «Розница» — только один раз за жизнь страницы (см. doc comment выше): пока ссылка
    // не задаёт `?departmentId=` явно, ждём загрузки справочника отделов и подставляем «Розницу»
    // по имени (в проекте нет отдельной константы её id, см. `useSalaryReportPage.ts`/
    // `useWorkSchedulePage.ts` — тот же приём поиска по имени). `defaultAppliedRef` не даёт этому
    // сработать повторно, иначе выбор «Все отделы» (тоже `departmentId: null`, тоже убирает
    // параметр из URL) был бы неотличим от «дефолт ещё не применён» и откатывался бы обратно.
    const defaultAppliedRef = useRef(false)
    useEffect(() => {
        if (defaultAppliedRef.current) return
        if (rawDepartmentId !== null) {
            defaultAppliedRef.current = true
            return
        }
        if (!departments.data) return
        defaultAppliedRef.current = true
        const retail = departments.data.find((department) => department.name === 'Розница')
        if (retail) setDepartmentId(retail.id)
    }, [rawDepartmentId, departments.data, setDepartmentId])

    const summaryQuery = useQuery({
        ...api.getBalanceSummary(DEFAULT_PERIOD, {
            departmentId: departmentId ?? undefined,
            search: trimmedSearch.length > 0 ? trimmedSearch : undefined,
        }),
        placeholderData: keepPreviousData,
    })

    const employees = summaryQuery.data?.employees ?? []
    const totals = summaryQuery.data?.totals ?? {
        balance: 0,
        toPay: { amount: 0, count: 0 },
        debt: { amount: 0, count: 0 },
    }

    const loading = isDebouncing || summaryQuery.isFetching
    const isInitialLoad = loading && summaryQuery.data === undefined
    const isRefreshing = loading && !isInitialLoad

    return {
        departmentId,
        setDepartmentId,
        departments: departments.data ?? [],
        isDepartmentsLoading: departments.isLoading,

        search,
        setSearch,

        employees,
        totals,

        dataAsOfLabel: summaryQuery.dataUpdatedAt > 0 ? formatShortDateTime(summaryQuery.dataUpdatedAt) : null,

        isInitialLoad,
        isRefreshing,
        dataVersion: summaryQuery.dataUpdatedAt,
        error: summaryQuery.error?.message ?? null,
    }
}
