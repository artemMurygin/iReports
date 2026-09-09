import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useAccountingPeriod } from '@/features/AccountingPeriod'

import { shopApi } from './api.ts'
import { flattenCatalog, resolveDescendantIds, type ShopCategoryRef } from './categoryTree.ts'
import { denormalizeShopReportLines, type ShopGoodsTurnoverRow } from './goodsTurnoverTree.ts'

// '2026-08' — текущий месяц `YYYY-MM`, тот же приём, что `getCurrentPeriod()` в `../
// useGoodsTurnoverReportPage.ts` (направление `service`) — не общий хелпер, см. комментарий там.
function getCurrentPeriod(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Страничный `useXPage`-хук вкладки «Магазин» страницы `/goods-turnover-report` — адаптация `../
 * useGoodsTurnoverReportPage.ts` (направление `service`) под контракт `shop`: три независимых
 * запроса (каталог категорий/справочник складов — `staleTime` 30 минут, отчёт по выбранному
 * `period`), денормализация сырых строк отчёта именами категории/склада (`denormalizeShopReportLines`
 * — `shop`-контракт их не отдаёт, см. `model/shop/goodsTurnoverTree.ts`), дефолт склада —
 * производное значение (первый склад справочника, без `useEffect`+`setState`), фильтрация строк
 * по складу/поддереву категории на фронтенде (смена склада/категории новый запрос не вызывает).
 *
 * Статус периода читается из `AccountingPeriod` направления `shop`
 * (`useAccountingPeriod('shop', period)`, уже существующий `GET /v1/shop/accounting/period/
 * :period`) — тот же приём, что у `service`.
 */
export function useShopGoodsTurnoverReportPage() {
    const [period, setPeriod] = useState<string>(getCurrentPeriod)
    const [selectedWarehouseId, setWarehouseId] = useState<string | null>(null)
    const [categoryId, setCategoryId] = useState<string | null>(null)

    const catalogQuery = useQuery(shopApi.getCatalog())
    const storesQuery = useQuery(shopApi.getStores())

    const {
        data: lines,
        dataUpdatedAt,
        isFetching,
        error: queryError,
        refetch,
    } = useQuery({
        ...shopApi.getShopGoodsTurnoverReport(period),
        placeholderData: keepPreviousData,
    })

    const { isClosed } = useAccountingPeriod('shop', period)

    const categories = useMemo<ShopCategoryRef[]>(
        () => flattenCatalog(catalogQuery.data ?? []),
        [catalogQuery.data],
    )
    const warehouses = useMemo(() => storesQuery.data ?? [], [storesQuery.data])

    const warehouseId = selectedWarehouseId ?? warehouses[0]?.id ?? null

    const denormalizedLines = useMemo(
        () => denormalizeShopReportLines(lines ?? [], categories, warehouses),
        [lines, categories, warehouses],
    )

    const rows = useMemo<ShopGoodsTurnoverRow[]>(() => {
        if (warehouseId === null) return []
        const byWarehouse = denormalizedLines.filter((line) => line.warehouseId === warehouseId)
        if (categoryId === null) return byWarehouse
        const allowedIds = new Set(resolveDescendantIds(categories, categoryId))
        return byWarehouse.filter((line) => allowedIds.has(line.categoryId))
    }, [denormalizedLines, warehouseId, categoryId, categories])

    const loading = isFetching
    const isInitialLoad = loading && lines === undefined
    const isRefreshing = loading && !isInitialLoad

    const error =
        (queryError?.message ?? catalogQuery.error?.message ?? storesQuery.error?.message ?? null) as string | null

    return {
        period,
        setPeriod,
        maxPeriod: getCurrentPeriod(),
        warehouseId,
        setWarehouseId,
        categoryId,
        setCategoryId,

        categories,
        warehouses,
        lines,
        rows,

        isClosed,
        isInitialLoad,
        isRefreshing,
        error,
        retry: refetch,
        dataVersion: dataUpdatedAt,
    }
}

export type ShopGoodsTurnoverReportPageState = ReturnType<typeof useShopGoodsTurnoverReportPage>
