import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { SalesDirection } from 'ireports-contracts'

import { api } from './api.ts'

/**
 * Список документов начисления за период. `keepPreviousData` + разделение
 * `isInitialLoad`/`isRefreshing` — конвенция useSalesPlan/useServicesAnalytics
 * (frontend/CLAUDE.md): переключение направления/месяца не схлопывает уже
 * отрисованную таблицу в спиннер.
 */
export function useSalaryAccruals(direction: SalesDirection, period: string) {
    const query = useQuery({
        ...api.getAccruals(direction, period),
        placeholderData: keepPreviousData,
    })

    const items = query.data?.items ?? []
    const isInitialLoad = query.isFetching && query.data === undefined
    const isRefreshing = query.isFetching && !isInitialLoad

    return {
        items,
        totalAmount: query.data?.total ?? 0,
        isInitialLoad,
        isRefreshing,
        dataVersion: query.dataUpdatedAt,
        error: query.error?.message ?? null,
    }
}

/** Карточка документа начисления со строками (страница /salary-accruals/:id). */
export function useSalaryAccrual(direction: SalesDirection, id: string) {
    const query = useQuery({
        ...api.getAccrual(direction, id),
        placeholderData: keepPreviousData,
    })

    const isInitialLoad = query.isFetching && query.data === undefined

    return {
        document: query.data,
        isInitialLoad,
        isRefreshing: query.isFetching && !isInitialLoad,
        dataVersion: query.dataUpdatedAt,
        error: query.error?.message ?? null,
    }
}
