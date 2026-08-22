import { type Dispatch, type SetStateAction, useEffect } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/pages/FunnelReport/model/api.ts'
import type { DashboardFilters, DashboardKPI } from '@/pages/FunnelReport/model/types.ts'
import { useDebounce } from '@/shared/hooks/useDebounce'

const DEBOUNCE_MS = 1000

export function useDeals(filters: DashboardFilters, setError: Dispatch<SetStateAction<string | null>>) {
    const { debouncedValue: debouncedFilters, isDebouncing } = useDebounce(filters, DEBOUNCE_MS)

    const {
        data,
        dataUpdatedAt,
        isFetching,
        error: queryError,
    } = useQuery({
        ...api.getDeals(debouncedFilters),
        placeholderData: keepPreviousData,
    })

    useEffect(() => {
        if (queryError) setError(queryError.message ?? 'Не удалось загрузить данные')
    }, [queryError, setError])

    const loading = isDebouncing || isFetching
    const isInitialLoad = loading && data?.deals.length === 0
    const isRefreshing = loading && !isInitialLoad
    const KPI: Partial<DashboardKPI> = data?.KPI ?? {}

    return {
        loading,
        isInitialLoad,
        isRefreshing,
        dataVersion: dataUpdatedAt,
        deals: data?.deals ?? [],
        KPI,
    }
}
