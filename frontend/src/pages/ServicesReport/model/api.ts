import { queryOptions } from '@tanstack/react-query'
import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import type { ServicesAnalyticsResponse, ServiceCategory, ServicesFilters } from './types.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

export const api = {
    getCategories: () =>
        queryOptions({
            queryKey: ['services', 'categories'],
            staleTime: 30 * 60 * 1000,
            queryFn: async ({ signal }): Promise<ServiceCategory[]> =>
                apiInstance
                    .get<ServiceCategory[]>('/reports/service-categories', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить категории услуг ' + error)
                    }),
        }),

    getServicesAnalytics: (filters: ServicesFilters, resolvedCategoryIds: number[]) => {
        const {
            dateRange, groupBy, serviceIds,
        } = filters

        return queryOptions({
            queryKey: ['services', 'services-analytics', filters, resolvedCategoryIds],
            queryFn: ({ signal }) =>
                apiInstance
                    .get<ServicesAnalyticsResponse>('/reports/services-analytics', {
                        signal,
                        params: {
                            momentFrom: dateRange.from,
                            momentTo: dateRange.to,
                            groupBy,
                            categoryIds: resolvedCategoryIds,
                            serviceIds: serviceIds.map(Number),
                        },
                    })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить аналитику по услугам ' + error)
                    }),
        })
    },
}
