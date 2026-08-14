import { queryOptions } from '@tanstack/react-query'
import type { SalesPerformanceResponse, ServiceCategoryResponse } from 'ireports-contracts'
import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

// Фаза 1 реализует только направление service (см.
// docs/sales-plan-view-page/plan-sales-plan-view-page.md) — GET
// /v1/service/sales/salesPerformance/:period?direction=service. Направление shop
// (GET /v1/shop/sales/salesPerformance/:period, без query) добавится в Фазе 4.
export const api = {
    getSalesPerformance: (period: string) =>
        queryOptions({
            queryKey: ['sales-plan', 'sales-performance', 'service', period],
            queryFn: ({ signal }) =>
                apiInstance
                    .get<SalesPerformanceResponse[]>(`/v1/service/sales/salesPerformance/${period}`, {
                        signal,
                        params: { direction: 'service' },
                    })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить план продаж ' + error)
                    }),
        }),

    getServiceCategories: () =>
        queryOptions({
            queryKey: ['sales-plan', 'service-categories'],
            staleTime: 30 * 60 * 1000,
            queryFn: ({ signal }) =>
                apiInstance
                    .get<ServiceCategoryResponse[]>('/v1/service/reports/service-categories', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить категории услуг ' + error)
                    }),
        }),
}
