import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/pages/ServicesReport/model/api.ts'
import { buildChartSeries, resolveDescendantIds } from '@/pages/ServicesReport/model/categoryTree.ts'
import type { ServicesFilters, ServiceCategory } from '@/pages/ServicesReport/model/types.ts'
import { useDebounce } from '@/shared/hooks/useDebounce'

const DEBOUNCE_MS = 1000

export function useServicesAnalytics(
    filters: ServicesFilters,
    categories: ServiceCategory[],
    setError: Dispatch<SetStateAction<string | null>>,
) {
    const { debouncedValue: debouncedFilters, isDebouncing } = useDebounce(filters, DEBOUNCE_MS)

    const resolvedCategoryIds = useMemo(() => {
        if (!debouncedFilters.selectedCategoryId) return []
        return resolveDescendantIds(categories, debouncedFilters.selectedCategoryId)
    }, [debouncedFilters.selectedCategoryId, categories])

    const {
        data,
        dataUpdatedAt,
        isFetching,
        error: queryError,
    } = useQuery({
        ...api.getServicesAnalytics(debouncedFilters, resolvedCategoryIds),
        enabled: Boolean(debouncedFilters.dateRange.from && debouncedFilters.dateRange.to),
        placeholderData: keepPreviousData,
    })

    // dataUpdatedAt меняется только когда приходит новый датасет (placeholderData
    // держит старый data, пока идёт рефетч), поэтому категорию для построения
    // серий графика фиксируем в тот же момент — иначе во время смены категории
    // старые services на миг окажутся сгруппированы под новый selectedCategoryId.
    const [committedCategoryId, setCommittedCategoryId] = useState(
        debouncedFilters.selectedCategoryId,
    )
    const debouncedFiltersRef = useRef(debouncedFilters)
    debouncedFiltersRef.current = debouncedFilters
    useEffect(() => {
        setCommittedCategoryId(debouncedFiltersRef.current.selectedCategoryId)
    }, [dataUpdatedAt])

    useEffect(() => {
        if (queryError) setError(queryError.message ?? 'Не удалось загрузить данные')
    }, [queryError, setError])

    const services = data?.services ?? []

    const { series } = useMemo(
        () => buildChartSeries(services, categories, committedCategoryId),
        [services, categories, committedCategoryId],
    )

    const loading = isDebouncing || isFetching
    const isInitialLoad = loading && services.length === 0
    const isRefreshing = loading && !isInitialLoad

    return { services, series, loading, isInitialLoad, isRefreshing, dataVersion: dataUpdatedAt }
}
