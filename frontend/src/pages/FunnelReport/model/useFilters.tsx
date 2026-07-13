import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { DashboardFilters } from '@/pages/FunnelReport/model/types.ts'
import { api } from '@/pages/FunnelReport/model/api.ts'
import { startOfMonth } from 'date-fns'

const today = new Date()
export const defaults: DashboardFilters = {
    dateRange: {
        from: startOfMonth(today),
        to: today,
    },
    managers: [],
    sources: [],
    deviceTypes: [],
    stages: [],
    stageGroups: [],
}

export function useFilters() {
    const [filters, setFilters] = useState<DashboardFilters>(defaults)
    const [error, setError] = useState<string | null>(null)

    const { data, error: queryError } = useQuery(api.getFilterOptions())

    useEffect(() => {
        if (queryError) setError(queryError.message ?? 'Не удалось загрузить данные')
    }, [queryError])

    const employees = data?.employees ?? []
    const sources = data?.sources ?? []
    const deviceTypes = data?.deviceTypes ?? []
    const stages = data?.stages ?? []
    const stageGroups = data?.stageGroups ?? []

    const resetHandler = () => {
        setFilters(defaults)
    }

    return {
        filters,
        employees,
        sources,
        deviceTypes,
        stages,
        stageGroups,
        setError,
        error,
        resetHandler,
        setFilters,
    }
}
