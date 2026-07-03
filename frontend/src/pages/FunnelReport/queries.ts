import { queryOptions } from '@tanstack/react-query'
import { api } from '@/shared/axios.instance.ts'
import type { DashboardFilters, ServiceFunnelResponse } from './types.ts'

export const serviceFunnelQuery = (filters: DashboardFilters) => {
    const { dateRange, stages, managers, sources, deviceTypes, stageGroups } = filters
    return queryOptions({
        queryKey: ['funnel', 'service-funnel', filters],
        queryFn: ({ signal }) =>
            api
                .get<ServiceFunnelResponse>('/reports/service-funnel', {
                    signal,
                    params: {
                        momentFrom: dateRange.from,
                        momentTo: dateRange.to,
                        stageIds: stages,
                        managerIds: managers,
                        sourceIds: sources,
                        modelIds: deviceTypes,
                        stageGroupIds: stageGroups,
                    },
                })
                .then((r) => r.data),
    })
}
