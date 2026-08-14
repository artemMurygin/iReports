import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SalesDirection, SalesPerformanceResponse } from 'ireports-contracts'
import { api } from '@/features/SalesPlan/model/api.ts'

// Пикера периода в скоупе этой фазы нет (см. Фазу 1 в
// docs/sales-plan-view-page/plan-sales-plan-view-page.md) — период захардкожен,
// т.к. тестовые данные SalesPerformance гарантированно есть только за этот месяц
// (для любого другого периода бэкенд отдаёт пустой список).
export const DEFAULT_PERIOD = '2026-06'

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
}

export type SalesPlanTotals = {
    categoriesCount: number
    planTurnover: number
    factTurnover: number
    prognoseTurnover: number
    planMargin: number
    factMargin: number
}

const NO_CATEGORY_LABEL = 'Без категории'

const EMPTY_TOTALS: SalesPlanTotals = {
    categoriesCount: 0,
    planTurnover: 0,
    factTurnover: 0,
    prognoseTurnover: 0,
    planMargin: 0,
    factMargin: 0,
}

export function useSalesPlan(direction: SalesDirection = DEFAULT_DIRECTION) {
    // Фаза 4 плана подключит собственный источник данных для shop (свой
    // salesPerformance-эндпоинт + резолв категорий каталога МойСклад, см. Фазу 4 в
    // docs/sales-plan-view-page/plan-sales-plan-view-page.md). До тех пор вкладка
    // «Магазин» лишь переключает состояние на странице и передаёт direction сюда —
    // запрос к бэкенду за service-данными на ней намеренно не выполняется.
    const enabled = direction === 'service'

    const {
        data: performance,
        isLoading: isPerformanceLoading,
        error: performanceError,
    } = useQuery({ ...api.getSalesPerformance(DEFAULT_PERIOD), enabled })

    const {
        data: categories,
        isLoading: isCategoriesLoading,
        error: categoriesError,
    } = useQuery({ ...api.getServiceCategories(), enabled })

    const rows = useMemo<SalesPlanRow[]>(() => {
        if (!performance) return []

        const categoryNameById = new Map((categories ?? []).map((category) => [String(category.id), category.name]))

        return performance
            .filter((row) => row.department === HARDCODED_DEPARTMENT_ID)
            .map((row) => ({
                ...row,
                categoryName: row.category === null ? NO_CATEGORY_LABEL : (categoryNameById.get(row.category) ?? row.category),
                remaining: row.plan.turnover - row.fact.turnover,
                remainingMargin: row.plan.margin - row.fact.margin,
                marginPercent: row.plan.margin !== 0 ? (row.fact.margin / row.plan.margin) * 100 : 0,
            }))
    }, [performance, categories])

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

    const isLoading = enabled && (isPerformanceLoading || isCategoriesLoading)
    const error = enabled ? (performanceError ?? categoriesError ?? null) : null

    return {
        rows,
        totals,
        isLoading,
        error: error?.message ?? null,
        period: DEFAULT_PERIOD,
        direction,
    }
}
