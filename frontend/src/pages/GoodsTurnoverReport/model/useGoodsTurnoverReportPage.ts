import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useAccountingPeriod } from '@/features/AccountingPeriod'
import { api } from '@/pages/GoodsTurnoverReport/model/api.ts'
import { resolveDescendantIds } from '@/pages/GoodsTurnoverReport/model/categoryTree.ts'
import type { GoodsTurnoverRow } from '@/pages/GoodsTurnoverReport/model/goodsTurnoverTree.ts'

// '2026-08' — текущий месяц в формате `YYYY-MM`, который ожидает бэкенд (`Period.create`,
// `backend/src/shared/domain/period.value-object.ts`). Тот же приём, что и `getCurrentPeriod()` в
// `features/SalaryReportData/model/useSalaryReportSelection.ts` — не общий хелпер, каждая страница
// с полем периода строит его сама из `Date` (см. комментарий там же).
function getCurrentPeriod(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Страничный `useXPage`-хук (`frontend/CLAUDE.md`, плоский объект состояния) страницы
 * `/goods-turnover-report` (openspec/changes/service-turnover-report, задача 15;
 * architecture.md — "один основной виджет на странице → один model/useGoodsTurnoverReportPage.ts
 * хук, без отдельного mediator/").
 *
 * Три независимых запроса: справочники категорий/складов (`staleTime` 30 минут, грузятся один раз)
 * и сам отчёт по выбранному `period` (`api.getGoodsTurnoverReport`, `queryKey` зависит от периода —
 * смена периода естественно инициирует новый запрос). Смена `warehouseId`/`categoryId` нового
 * запроса НЕ вызывает — `GoodsTurnoverTable` (задача 18) фильтрует уже загруженные `report.lines`
 * на фронтенде (см. комментарий в `model/api.ts`).
 *
 * `warehouseId` по умолчанию `null` (пользователь ещё не выбирал) — наружу отдаётся производное
 * значение: пока пользователь не выбрал склад явно, подставляется первый склад из уже
 * загруженного справочника, без `useEffect`+`setState` (react-hooks/set-state-in-effect — то же
 * правило, что уже требует избегать этого паттерна в новом коде проекта), чтобы
 * `GoodsTurnoverTable` сразу показывала содержательные данные, а не пустое состояние выбора
 * склада. `categoryId` по умолчанию `null` — «Все категории» (`CategoryTreeSelect`, задача 17,
 * тот же смысл `null`, что `selectedCategoryId` в `pages/ServicesReport`).
 *
 * `isInitialLoad`/`isRefreshing` — та же формула, что `useServicesAnalytics`: `useQuery` отчёта с
 * `placeholderData: keepPreviousData`, `isInitialLoad` — идёт загрузка и строк ещё нет,
 * `isRefreshing` — идёт загрузка, но старые строки уже отрисованы (смена периода не должна
 * «схлопывать» уже показанную таблицу, architecture.md).
 *
 * Задача 19 (openspec/changes/service-turnover-report, «состояния экрана») добавляет:
 * - `rows` — `report.lines`, отфильтрованные по выбранному складу и (если выбрана) поддереву
 *   категории (`resolveDescendantIds`, задача 17) — именно это, а не сырой `report.lines`, уходит
 *   в `GoodsTurnoverTable` (architecture.md: "для выбранного склада"; строки таблицы уникальны по
 *   `categoryId`, поэтому фильтрация по одному складу обязательна ДО построения дерева —
 *   `model/goodsTurnoverTree.ts`, задача 18). `warehouseId === null` (пустой справочник складов) —
 *   отфильтровать нечего, пустой список.
 * - `retry` — `refetch` запроса отчёта, под кнопку «Повторить» в `GoodsTurnoverErrorState`.
 * - `isClosed`/`maxPeriod` — статус расчётного периода направления `service` за выбранный месяц
 *   (`useAccountingPeriod`, `features/AccountingPeriod` — переиспользует существующий `GET
 *   /v1/service/accounting/period/:period`, design.md D5: "статус периода не дублируется, читается
 *   из AccountingPeriod") и верхняя граница выбора периода (текущий месяц) для `PeriodPicker`.
 *   Ошибка загрузки статуса периода намеренно НЕ подмешивается в общий `error` ниже — сбой одного
 *   вспомогательного бейджа не должен подменять всю таблицу карточкой ошибки.
 */
export function useGoodsTurnoverReportPage() {
    const [period, setPeriod] = useState<string>(getCurrentPeriod)
    const [selectedWarehouseId, setWarehouseId] = useState<number | null>(null)
    const [categoryId, setCategoryId] = useState<number | null>(null)

    const categoriesQuery = useQuery(api.getProductCategories())
    const warehousesQuery = useQuery(api.getWarehouses())

    const {
        data: report,
        dataUpdatedAt,
        isFetching,
        error: queryError,
        refetch,
    } = useQuery({
        ...api.getGoodsTurnoverReport(period),
        placeholderData: keepPreviousData,
    })

    const { isClosed } = useAccountingPeriod('service', period)

    // `useMemo` (не просто `?? []`) — иначе на каждом рендере до первой загрузки справочника
    // создаётся новый массив-литерал, из-за чего `react-hooks/exhaustive-deps` считает
    // `categories` нестабильной зависимостью `rows`'ного `useMemo` ниже.
    const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
    const warehouses = useMemo(() => warehousesQuery.data ?? [], [warehousesQuery.data])

    // Дефолт склада — производное значение, а не setState в эффекте (react-hooks/set-state-in-
    // effect): пока пользователь не выбрал склад явно, подставляется первый склад уже
    // загруженного справочника (см. комментарий над хуком).
    const warehouseId = selectedWarehouseId ?? warehouses[0]?.id ?? null

    const rows = useMemo<GoodsTurnoverRow[]>(() => {
        if (warehouseId === null) return []
        const byWarehouse = (report?.lines ?? []).filter((line) => line.warehouseId === warehouseId)
        if (categoryId === null) return byWarehouse
        const allowedIds = new Set(resolveDescendantIds(categories, categoryId))
        return byWarehouse.filter((line) => allowedIds.has(line.categoryId))
    }, [report, warehouseId, categoryId, categories])

    const loading = isFetching
    const isInitialLoad = loading && report === undefined
    const isRefreshing = loading && !isInitialLoad

    const error =
        (queryError?.message ?? categoriesQuery.error?.message ?? warehousesQuery.error?.message ?? null) as
            | string
            | null

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
        report,
        rows,

        isClosed,
        isInitialLoad,
        isRefreshing,
        error,
        retry: refetch,
        dataVersion: dataUpdatedAt,
    }
}

export type GoodsTurnoverReportPageState = ReturnType<typeof useGoodsTurnoverReportPage>
