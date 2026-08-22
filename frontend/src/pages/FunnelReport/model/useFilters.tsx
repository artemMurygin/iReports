import { useState } from 'react'
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
    // Ошибка, которую записывает useDeals через setError; ошибка запроса
    // опций фильтров не копируется в стейт эффектом (react-hooks/
    // set-state-in-effect), а выводится из queryError прямо при рендере.
    const [externalError, setError] = useState<string | null>(null)

    const { data, error: queryError } = useQuery(api.getFilterOptions())

    const error = externalError ?? (queryError ? (queryError.message ?? 'Не удалось загрузить данные') : null)

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
