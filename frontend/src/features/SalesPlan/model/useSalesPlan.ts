import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import type { CatalogResponse, SalesDirection, SalesPerformanceResponse } from 'ireports-contracts'
import { api } from '@/features/SalesPlan/model/api.ts'

// Начальное значение периода на странице (pages/SalesPlan/ui/SalesPlanPage.tsx владеет
// самим состоянием — см. PeriodPicker) — текущий календарный месяц; для периода без
// данных SalesPerformance бэкенд отдаёт пустой список, который уже корректно рендерится
// как SalesPlanEmptyState, а не падает.
export const DEFAULT_PERIOD = format(new Date(), 'yyyy-MM')

// Дизайн (design/sallary-first-iteration.pen) не показывает отдел вовсе, а
// SalesPerformance реально возвращает строки по нескольким отделам на одно
// направление — решение пользователя: фильтровать локально на фронте по
// фиксированному отделу вместо агрегации по отделам в UI (см. Фазу 1 плана).
export const HARDCODED_DEPARTMENT_ID = 160

export const DEFAULT_DIRECTION: SalesDirection = 'service'

export type SalesPlanRow = SalesPerformanceResponse & {
    categoryName: string
    /** `plan.turnover - fact.turnover` — "Осталось, ₽" на линии выручки. */
    remaining: number
    /** `plan.margin - fact.margin` — "Осталось, ₽" на линии маржи. */
    remainingMargin: number
    /** `fact.margin / plan.margin * 100` — прогресс-бар линии маржи (у `fact`/`prognose` есть готовый `percentCompletion` для выручки, но не для маржи). */
    marginPercent: number
    /** Человекочитаемые названия `plan.orderTypeIds` (справочник `GET .../reports/order-type`,
     * см. `api.getOrderTypes`) — пустой массив как для "все типы" (`orderTypeIds: []`), так и для
     * направления `shop` (справочник типов заказов там не запрашивается, см. Фазу 1
     * docs/service-plan-salary-rule-order-category-filter). Неизвестный id (справочник ещё не
     * успел прогрузиться) отображается как сам id, а не молча пропадает. */
    orderTypeNames: string[]
}

export type SalesPlanTotals = {
    categoriesCount: number
    planTurnover: number
    factTurnover: number
    prognoseTurnover: number
    planMargin: number
    factMargin: number
}

const NO_CATEGORY_LABEL = 'Все направление'

const EMPTY_TOTALS: SalesPlanTotals = {
    categoriesCount: 0,
    planTurnover: 0,
    factTurnover: 0,
    prognoseTurnover: 0,
    planMargin: 0,
    factMargin: 0,
}

// Дерево warehouse/catalog (CatalogResponse) разворачивается в плоскую map id -> полный путь
// категории — в отличие от service-categories это не плоский список, а дерево папок МойСклад.
// `pathName` сам по себе — это путь ПРЕДКОВ, не включая саму категорию (пустая строка у
// категорий верхнего уровня, см. комментарий у ProductFolderTreeService в
// backend/src/domains/shop/sync/moySklad/product-folder-tree.service.ts) — поэтому полный
// путь для показа считается на лету как `pathName + '/' + name` (или просто `name` для
// категорий верхнего уровня, где pathName == ''), а не берётся из pathName напрямую: иначе
// категории верхнего уровня резолвились бы в пустую строку, а вложенные — теряли бы
// собственное имя (см. Фазу 4 в docs/sales-plan-view-page/plan-sales-plan-view-page.md).
function flattenCatalog(categories: CatalogResponse, map: Map<string, string> = new Map()): Map<string, string> {
    for (const category of categories) {
        // pathName сегменты сами разделены "/" без пробелов ("Аксессуары/Чехлы") — пересобираем
        // через " / " целиком (включая имя самой категории), чтобы разделитель был единообразным.
        const segments = category.pathName ? [...category.pathName.split('/'), category.name] : [category.name]
        map.set(category.id, segments.join(' / '))
        flattenCatalog(category.children, map)
    }
    return map
}

/** Словарь `id категории МойСклад -> человекочитаемое полное имя` (см. `flattenCatalog` выше) —
 * вынесен в отдельный хук, а не только внутрь `useSalesPlan`, потому что нужен и
 * `pages/SalaryReportV2` (карточка плана продаж магазина с разбивкой по категориям, `/salaries`), у
 * которой нет своего среза `SalesPerformance` по категории (тот приходит уже в отчёте по
 * зарплате), только сами id категорий — резолвить их в имя нужно тем же каталогом, что и на
 * `/sales-plan`. `staleTime` тот же, что у `api.getShopCatalog()` внутри `useSalesPlan`. */
export function useShopCategoryNames() {
    const { data: shopCatalog } = useQuery({ ...api.getShopCatalog(), placeholderData: keepPreviousData })
    return useMemo(() => flattenCatalog(shopCatalog ?? []), [shopCatalog])
}

export function useSalesPlan(direction: SalesDirection = DEFAULT_DIRECTION, period: string = DEFAULT_PERIOD) {
    const isShop = direction === 'shop'

    // placeholderData: keepPreviousData (см. frontend/CLAUDE.md, "isInitialLoad / isRefreshing
    // вместо единого isLoading") — при переключении направления/периода/фоновом рефетче старые
    // строки остаются на экране вместо схлопывания в пустое состояние; loading-флаги считаются
    // от isFetching (а не isLoading/isPending), как в useServicesAnalytics/useDeals. `period`
    // входит в queryKey (см. model/api.ts) — смена периода в PeriodPicker сама триггерит рефетч.
    const {
        data: servicePerformance,
        dataUpdatedAt: servicePerformanceUpdatedAt,
        isFetching: isServicePerformanceFetching,
        error: servicePerformanceError,
    } = useQuery({ ...api.getSalesPerformance(period), enabled: !isShop, placeholderData: keepPreviousData })

    const {
        data: serviceCategories,
        isFetching: isServiceCategoriesFetching,
        error: serviceCategoriesError,
    } = useQuery({ ...api.getServiceCategories(), enabled: !isShop, placeholderData: keepPreviousData })

    const {
        data: orderTypes,
        isFetching: isOrderTypesFetching,
        error: orderTypesError,
    } = useQuery({ ...api.getOrderTypes(), enabled: !isShop, placeholderData: keepPreviousData })

    const {
        data: shopPerformance,
        dataUpdatedAt: shopPerformanceUpdatedAt,
        isFetching: isShopPerformanceFetching,
        error: shopPerformanceError,
    } = useQuery({ ...api.getShopSalesPerformance(period), enabled: isShop, placeholderData: keepPreviousData })

    const {
        data: shopCatalog,
        isFetching: isShopCatalogFetching,
        error: shopCatalogError,
    } = useQuery({ ...api.getShopCatalog(), enabled: isShop, placeholderData: keepPreviousData })

    const performance = isShop ? shopPerformance : servicePerformance
    const isPerformanceFetching = isShop ? isShopPerformanceFetching : isServicePerformanceFetching
    // Справочник типов заказов запрашивается только для service (см. api.getOrderTypes) — для
    // shop isOrderTypesFetching/orderTypesError остаются в их начальном "выключенном" состоянии
    // (false/null, запрос enabled: false) и не влияют на итоговые флаги ниже.
    const isCategoriesFetching = isShop ? isShopCatalogFetching : isServiceCategoriesFetching || isOrderTypesFetching
    const performanceError = isShop ? shopPerformanceError : servicePerformanceError
    const categoriesError = isShop ? shopCatalogError : (serviceCategoriesError ?? orderTypesError)
    const dataVersion = isShop ? shopPerformanceUpdatedAt : servicePerformanceUpdatedAt

    const categoryNameById = useMemo(() => {
        if (isShop) return flattenCatalog(shopCatalog ?? [])
        return new Map((serviceCategories ?? []).map((category) => [String(category.id), category.name]))
    }, [isShop, shopCatalog, serviceCategories])

    const orderTypeNameById = useMemo(
        () => new Map((orderTypes ?? []).map((orderType) => [orderType.id, orderType.name])),
        [orderTypes],
    )

    const rows = useMemo<SalesPlanRow[]>(() => {
        if (!performance) return []

        return performance
            .filter((row) => row.department === HARDCODED_DEPARTMENT_ID)
            .map((row) => ({
                ...row,
                categoryName:
                    row.category === null ? NO_CATEGORY_LABEL : (categoryNameById.get(row.category) ?? row.category),
                remaining: row.plan.turnover - row.fact.turnover,
                remainingMargin: row.plan.margin - row.fact.margin,
                marginPercent: row.plan.margin !== 0 ? (row.fact.margin / row.plan.margin) * 100 : 0,
                orderTypeNames: row.plan.orderTypeIds.map((id) => orderTypeNameById.get(id) ?? String(id)),
            }))
    }, [performance, categoryNameById, orderTypeNameById])

    const totals = useMemo<SalesPlanTotals>(() => {
        if (rows.length === 0) return EMPTY_TOTALS

        return rows.reduce<SalesPlanTotals>(
            (acc, row) => ({
                categoriesCount: acc.categoriesCount + 1,
                planTurnover: acc.planTurnover + row.plan.turnover,
                factTurnover: acc.factTurnover + row.fact.turnover,
                prognoseTurnover: acc.prognoseTurnover + row.prognose.turnover,
                planMargin: acc.planMargin + row.plan.margin,
                factMargin: acc.factMargin + row.fact.margin,
            }),
            EMPTY_TOTALS,
        )
    }, [rows])

    const loading = isPerformanceFetching || isCategoriesFetching
    // Данные уже есть (строки отрисованы) -> фоновый рефетч (isRefreshing), а не блокирующая
    // загрузка (isInitialLoad) — иначе переключение вкладки Сервис/Магазин или ревалидация по
    // фокусу окна "схлопывали" бы уже отрисованную таблицу/карточки в спиннер на весь блок.
    const isInitialLoad = loading && rows.length === 0
    const isRefreshing = loading && !isInitialLoad
    // Ошибки уже нормализованы в ApiError прямо в queryFn (см. model/api.ts) — здесь наружу
    // отдаётся только человекочитаемое `.message`, компоненты не работают с сырым axios-error.
    const error = performanceError ?? categoriesError ?? null

    return {
        rows,
        totals,
        isInitialLoad,
        isRefreshing,
        dataVersion,
        error: error?.message ?? null,
        period,
        direction,
    }
}
