import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { endOfDay, startOfMonth } from 'date-fns'
import type { ServicesFilters } from '@/pages/ServicesReport/model/types.ts'
import { api } from '@/pages/ServicesReport/model/api.ts'
import { loadDataFromStorage, saveDataToStorage } from '@/shared/lib/storage.ts'
import { useDebounce } from '@/shared/hooks/useDebounce.ts'
import { resolveDescendantIds } from '@/pages/ServicesReport/model/categoryTree.ts'

const DEBOUNCE_MS = 1000
const STORAGE_KEY = 'filters:services-analytics'
const defaults: ServicesFilters = {
    dateRange: {
        from: startOfMonth(new Date()),
        to: endOfDay(new Date()),
    },
    selectedCategoryId: null,
    serviceIds: [],
    groupBy: 'day',
}

export function useFilters() {
    const [filters, setFiltersState] = useState<ServicesFilters>(() => {
        const data = loadDataFromStorage<ServicesFilters>(STORAGE_KEY)
        if (!data) return defaults
        return data
    })

    const { debouncedValue: debouncedFilters, isDebouncing } = useDebounce(filters, DEBOUNCE_MS)

    const [error, setError] = useState<string | null>(null)
    const setFilters = (value: ServicesFilters) => {
        saveDataToStorage(STORAGE_KEY, value)
        setFiltersState(value)
    }

    const { data, error: queryError } = useQuery(api.getCategories())

    useEffect(() => {
        if (queryError) setError(queryError.message ?? 'Не удалось загрузить данные')
    }, [queryError])

    const categories = data ?? []

    const resolvedCategoryIds = useMemo(() => {
        if (!debouncedFilters.selectedCategoryId) return []
        return resolveDescendantIds(categories, debouncedFilters.selectedCategoryId)
    }, [debouncedFilters.selectedCategoryId, categories])

    return {
        filters,
        debouncedFilters,
        isDebouncing,
        setFilters,
        setError,
        error,
        defaults,
        resolvedCategoryIds,
        categories,
    }
}
