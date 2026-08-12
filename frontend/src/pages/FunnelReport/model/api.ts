import { queryOptions } from '@tanstack/react-query'
import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import type { ApiDealSource, DashboardFilters, FilterOptionsResponse, ServiceFunnelResponse } from './types.ts'
import type { ApiEmployee, ApiEnumValue, ApiStageExtended } from '@/kernel/types'
import { ApiError } from '@/shared/errors/apiError.ts'

// Справочники сделок переехали из legacy `/deals/*` (src/TODO/deals) под
// `/v1/service/sales/deals/*` (см. docs/todo-modules-ddd-refactoring,
// Фазы 1-3); старых путей в коде фронтенда больше нет.
export const api = {
    getFilterOptions: () =>
        queryOptions({
            queryKey: ['funnel', 'filter-options'],
            staleTime: 30 * 60 * 1000,
            queryFn: async ({ signal }): Promise<FilterOptionsResponse> => {
                const [stagesRes, employeesRes, sourcesRes, deviceTypesRes, stageGroupsRes] = await Promise.all([
                    apiInstance.get<ApiStageExtended[]>('/v1/service/sales/deals/stages', {
                        signal,
                    }),
                    apiInstance.get<ApiEmployee[]>('/v1/service/sales/deals/managers', {
                        signal,
                    }),
                    apiInstance.get<ApiDealSource[]>('/v1/service/sales/deals/sources', {
                        signal,
                    }),
                    apiInstance.get<Pick<ApiEnumValue, 'id' | 'name'>[]>('/v1/service/sales/deals/models', {
                        signal,
                    }),
                    apiInstance.get<{ id: string; name: string }[]>('/v1/service/sales/deals/stage-groups', {
                        signal,
                    }),
                ]).catch((error) => {
                    throw new ApiError('Не удалось загрузить KPIs и сделки по БИТРИКС24 ' + error)
                })

                return {
                    stages: stagesRes.data,
                    employees: employeesRes.data,
                    sources: sourcesRes.data,
                    deviceTypes: deviceTypesRes.data,
                    stageGroups: stageGroupsRes.data,
                }
            },
        }),

    getDeals: (filters: DashboardFilters) => {
        const {
            dateRange: { from, to },
            stages,
            managers,
            sources,
            deviceTypes,
            stageGroups,
        } = filters

        return queryOptions({
            queryKey: ['funnel', 'deals', 'KPIs', filters],
            queryFn: ({ signal }) =>
                apiInstance
                    .get<ServiceFunnelResponse>('/reports/service-funnel', {
                        signal,
                        params: {
                            momentFrom: from,
                            momentTo: to,
                            stageIds: stages,
                            managerIds: managers,
                            sourceIds: sources,
                            modelIds: deviceTypes,
                            stageGroupIds: stageGroups,
                        },
                    })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить KPIs и сделки по БИТРИКС24 ' + error)
                    }),
        })
    },
}
