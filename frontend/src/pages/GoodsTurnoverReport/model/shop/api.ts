import { queryOptions } from '@tanstack/react-query'
import type { CatalogResponse, ShopGoodsTurnoverReportResponse, ShopStoresResponse } from 'ireports-contracts'
import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

// Query options factory (`frontend/CLAUDE.md`, "Query options factory") для вкладки «Магазин»
// страницы `/goods-turnover-report` (merge feat/shopTurnOverReport в feat/salary) — по образцу
// `../api.ts` (направление `service`), адаптированной под контракт `shop`:
// - `getShopGoodsTurnoverReport(period)` — сам отчёт (`GET /v1/shop/warehouse/
//   goods-turnover-report/:period`), плоский массив `{categoryId, warehouseId, ...}` БЕЗ
//   денормализованных имён категории/склада (в отличие от `service`) — имена
//   подтягиваются на фронтенде из `getCatalog()`/`getStores()` (см.
//   `model/shop/goodsTurnoverTree.ts`, `denormalizeShopReportLines`);
// - `getCatalog()` — дерево категорий каталога магазина (`GET /v1/shop/warehouse/catalog`,
//   уже готовое дерево `id/name/pathName/children`, не плоский список с `parentId`, как у
//   `service`);
// - `getStores()` — справочник складов МойСклад (`GET /v1/shop/warehouse/stores`).
// Смена склада/категории не инициирует новый запрос — `ShopGoodsTurnoverTable` фильтрует уже
// загруженные строки на фронтенде (тот же приём, что у `service`).
export const shopApi = {
    getShopGoodsTurnoverReport: (period: string) =>
        queryOptions({
            queryKey: ['goods-turnover-report', 'shop', 'report', period],
            queryFn: ({ signal }): Promise<ShopGoodsTurnoverReportResponse> =>
                apiInstance
                    .get<ShopGoodsTurnoverReportResponse>(`/v1/shop/warehouse/goods-turnover-report/${period}`, {
                        signal,
                    })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить отчёт по оборачиваемости товаров магазина ' + error)
                    }),
        }),

    getCatalog: () =>
        queryOptions({
            queryKey: ['goods-turnover-report', 'shop', 'catalog'],
            staleTime: 30 * 60 * 1000,
            queryFn: ({ signal }): Promise<CatalogResponse> =>
                apiInstance
                    .get<CatalogResponse>('/v1/shop/warehouse/catalog', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить каталог категорий магазина ' + error)
                    }),
        }),

    getStores: () =>
        queryOptions({
            queryKey: ['goods-turnover-report', 'shop', 'stores'],
            staleTime: 30 * 60 * 1000,
            queryFn: ({ signal }): Promise<ShopStoresResponse> =>
                apiInstance
                    .get<ShopStoresResponse>('/v1/shop/warehouse/stores', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить справочник складов магазина ' + error)
                    }),
        }),
}
