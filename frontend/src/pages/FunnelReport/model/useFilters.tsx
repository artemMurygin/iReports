import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { DashboardFilters } from '@/pages/FunnelReport/model/types.ts'
import { api } from '@/pages/FunnelReport/model/api.ts'
import { startOfMonth } from 'date-fns'
import { loadDataFromStorage, saveDataToStorage } from '@/shared/lib/storage.ts'

const STORAGE_KEY = 'filters:funnel-report'
const today = new Date()
const defaults: DashboardFilters = {
    dateRange: {
        from: startOfMonth(today),
        to: new Date(),
    },
    managers: [],
    sources: [],
    deviceTypes: [],
    stages: [],
    stageGroups: [],
}

export function useFilters() {
    const [filters, setFiltersState] = useState<DashboardFilters>(() => {
        const data = loadDataFromStorage<DashboardFilters>(STORAGE_KEY)
        if (!data) return defaults
        return data
    })
    const [error, setError] = useState<string | null>(null)

    const setFilters = (value: DashboardFilters) => {
        saveDataToStorage(STORAGE_KEY, value)
        setFiltersState(value)
    }

    const { data, error: queryError } = useQuery(api.getFilterOptions())

    useEffect(() => {
        if (queryError) setError(queryError.message ?? 'Не удалось загрузить данные')
    }, [queryError])

    const employees = data?.employees ?? []
    const sources = data?.sources ?? []
    const deviceTypes = data?.deviceTypes ?? []
    const stages = data?.stages ?? []
    const stageGroups = data?.stageGroups ?? []

    return {
        filters,
        employees,
        sources,
        deviceTypes,
        stages,
        stageGroups,
        setFilters,
        setError,
        error,
        defaults,
    }
}
