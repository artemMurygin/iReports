import type { ServicesFilters } from '@/pages/ServicesAnalytics/types.ts'
import { endOfDay, startOfMonth } from 'date-fns'
import { useState } from 'react'
import { loadFilters, saveFilters, parseDate } from '@/shared/lib/persistFilters.ts'

const STORAGE_KEY = 'filters:services-analytics'

export function makeDefaultFilters(): ServicesFilters {
    return {
        dateRange: {
            from: startOfMonth(new Date()),
            to: endOfDay(new Date()),
        },
        selectedCategoryId: null,
        serviceIds: [],
        groupBy: 'week',
    }
}

function revive(parsed: Record<string, unknown>): ServicesFilters {
    const defaults = makeDefaultFilters()
    const dr = parsed.dateRange as Record<string, unknown> | undefined
    const groupBy = parsed.groupBy
    return {
        dateRange: {
            from: parseDate(dr?.from) ?? defaults.dateRange.from,
            to: parseDate(dr?.to) ?? defaults.dateRange.to,
        },
        selectedCategoryId:
            typeof parsed.selectedCategoryId === 'string' ? parsed.selectedCategoryId : null,
        serviceIds: Array.isArray(parsed.serviceIds) ? parsed.serviceIds : [],
        groupBy:
            groupBy === 'day' || groupBy === 'week' || groupBy === 'month'
                ? groupBy
                : defaults.groupBy,
    }
}

export function useServiceFilters() {
    const [filters, setFiltersState] = useState<ServicesFilters>(() =>
        loadFilters(STORAGE_KEY, makeDefaultFilters(), revive),
    )

    const setFilters = (value: ServicesFilters) => {
        saveFilters(STORAGE_KEY, value)
        setFiltersState(value)
    }

    return { makeDefaultFilters, filters, setFilters }
}
