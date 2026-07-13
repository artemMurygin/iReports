import { type Dispatch, type SetStateAction, useEffect, useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/pages/ServicesReport/model/api.ts'
import { buildChartSeries } from '@/pages/ServicesReport/model/categoryTree.ts'
import type { ServiceCategory, ServicesFilters } from '@/pages/ServicesReport/model/types.ts'

export function useServicesAnalytics(
    filters: ServicesFilters,
    categories: ServiceCategory[],
    resolvedCategoryIds: number[],
    isDebouncing: boolean,
    setError: Dispatch<SetStateAction<string | null>>,
) {
    const {
        data,
        dataUpdatedAt,
        isFetching,
        error: queryError,
    } = useQuery({
        ...api.getServicesAnalytics(filters, resolvedCategoryIds),
        enabled: Boolean(filters.dateRange.from && filters.dateRange.to),
        placeholderData: keepPreviousData,
    })

    useEffect(() => {
        if (queryError) setError(queryError.message ?? 'Не удалось загрузить данные')
    }, [queryError, setError])

    const services = data?.services ?? []

    const { series } = useMemo(
        () => buildChartSeries(services, categories, filters.selectedCategoryId),
        [services, categories, filters.selectedCategoryId],
    )

    const loading = isDebouncing || isFetching
    const isInitialLoad = loading && services.length === 0
    const isRefreshing = loading && !isInitialLoad

    return {
        services,
        series,
        loading,
        isInitialLoad,
        isRefreshing,
        dataVersion: dataUpdatedAt,
    }
}
