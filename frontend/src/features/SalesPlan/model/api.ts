import { queryOptions } from '@tanstack/react-query'
import type {
    CatalogResponse,
    SalesPerformanceResponse,
    SalesPlanResponse,
    ServiceCategoryResponse,
    UpdateSalesPlanRequest,
} from 'ireports-contracts'
import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

export const api = {
    // GET /v1/service/sales/salesPerformance/:period?direction=service — direction идёт
    // query-параметром (симметрично GET /sales/plan, см. contracts/commands/sales-performance.ts).
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

    // GET /v1/shop/sales/salesPerformance/:period — направление shop зашито в путь, без
    // query-параметра direction (см. Фазу 4 в docs/sales-plan-view-page/plan-sales-plan-view-page.md).
    getShopSalesPerformance: (period: string) =>
        queryOptions({
            queryKey: ['sales-plan', 'sales-performance', 'shop', period],
            queryFn: ({ signal }) =>
                apiInstance
                    .get<SalesPerformanceResponse[]>(`/v1/shop/sales/salesPerformance/${period}`, { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить план продаж ' + error)
                    }),
        }),

    // GET /v1/shop/warehouse/catalog — дерево категорий каталога МойСклад (не плоский список,
    // в отличие от service-categories), разворачивается в плоскую map id -> pathName в useSalesPlan.
    getShopCatalog: () =>
        queryOptions({
            queryKey: ['sales-plan', 'shop-catalog'],
            staleTime: 30 * 60 * 1000,
            queryFn: ({ signal }) =>
                apiInstance
                    .get<CatalogResponse>('/v1/shop/warehouse/catalog', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить каталог магазина ' + error)
                    }),
        }),

    // PATCH /v1/service/sales/plan/:id и PATCH /v1/shop/sales/plan/:id — правка одной строки
    // плана (turnover и/или margin); direction/department/category/period заданы уже самим
    // :id и не передаются в теле (см. updateSalesPlanRequestSchema в
    // contracts/commands/sales-plan.ts). Не queryOptions — как и createMotivationSchema в
    // pages/SalaryRules/model/api.ts (первая мутация в проекте, см. её комментарий), это
    // обычная async-функция, разворачиваемая в useMutation в model/useUpdateSalesPlanRows.ts.
    updateSalesPlan: (id: string, payload: UpdateSalesPlanRequest): Promise<SalesPlanResponse> =>
        apiInstance
            .patch<SalesPlanResponse>(`/v1/service/sales/plan/${id}`, payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError('Не удалось обновить план продаж ' + error)
            }),

    updateShopSalesPlan: (id: string, payload: UpdateSalesPlanRequest): Promise<SalesPlanResponse> =>
        apiInstance
            .patch<SalesPlanResponse>(`/v1/shop/sales/plan/${id}`, payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError('Не удалось обновить план продаж ' + error)
            }),
}
