import { useMemo, useState } from 'react'
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

    // Ошибка, которую записывает useServicesAnalytics через setError; ошибка запроса
    // категорий не копируется в стейт эффектом (react-hooks/set-state-in-effect),
    // а выводится из queryError прямо при рендере.
    const [externalError, setError] = useState<string | null>(null)
    const setFilters = (value: ServicesFilters) => {
        saveDataToStorage(STORAGE_KEY, value)
        setFiltersState(value)
    }

    const { data, error: queryError } = useQuery(api.getCategories())

    const error = externalError ?? (queryError ? (queryError.message ?? 'Не удалось загрузить данные') : null)

    const categories = useMemo(() => data ?? [], [data])

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
