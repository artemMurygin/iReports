import { queryOptions } from '@tanstack/react-query'
import type { GetGoodsTurnoverReportResponse, ListProductCategoriesResponse, ListWarehousesResponse } from 'ireports-contracts'
import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

// Query options factory (`frontend/CLAUDE.md`, "Query options factory") для страницы
// `/goods-turnover-report` (openspec/changes/service-turnover-report, задача 15) — по образцу
// `pages/ServicesReport/model/api.ts`. Три источника данных:
// - `getGoodsTurnoverReport(period)` — сам отчёт, `queryKey` зависит от периода, поэтому смена
//   периода естественно инициирует новый запрос (design.md D8, backend `GET
//   /v1/service/warehouse/goods-turnover-report/:period`);
// - `getProductCategories()`/`getWarehouses()` — read-only справочники для `CategoryTreeSelect`
//   (задача 17) и `WarehouseSelect` (задача 16); фильтрация по выбранному складу/категории уже
//   загруженных строк отчёта происходит на фронтенде (см. architecture.md — `GoodsTurnoverTable`
//   получает `rows` для выбранного склада), поэтому смена склада/категории новый запрос НЕ
//   инициирует — только смена периода (см. `useGoodsTurnoverReportPage`).
export const api = {
    getGoodsTurnoverReport: (period: string) =>
        queryOptions({
            queryKey: ['goods-turnover-report', 'report', period],
            queryFn: ({ signal }): Promise<GetGoodsTurnoverReportResponse> =>
                apiInstance
                    .get<GetGoodsTurnoverReportResponse>(`/v1/service/warehouse/goods-turnover-report/${period}`, {
                        signal,
                    })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить отчёт по оборачиваемости товаров ' + error)
                    }),
        }),

    getProductCategories: () =>
        queryOptions({
            queryKey: ['goods-turnover-report', 'product-categories'],
            staleTime: 30 * 60 * 1000,
            queryFn: ({ signal }): Promise<ListProductCategoriesResponse> =>
                apiInstance
                    .get<ListProductCategoriesResponse>('/v1/service/warehouse/product-categories', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить категории товаров ' + error)
                    }),
        }),

    getWarehouses: () =>
        queryOptions({
            queryKey: ['goods-turnover-report', 'warehouses'],
            staleTime: 30 * 60 * 1000,
            queryFn: ({ signal }): Promise<ListWarehousesResponse> =>
                apiInstance
                    .get<ListWarehousesResponse>('/v1/service/warehouse/warehouses', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить справочник складов ' + error)
                    }),
        }),
}
