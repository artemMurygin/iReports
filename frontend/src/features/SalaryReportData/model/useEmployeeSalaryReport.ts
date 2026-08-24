import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'

import { api } from './api.ts'
import {
    SALARY_DIRECTION_LABELS,
    sumAllFactPrognose,
    type DirectionReportVM,
    type EmployeeReportVM,
    type SalaryDirection,
} from './types.ts'

const DIRECTIONS: readonly SalaryDirection[] = ['service', 'shop']

/**
 * Отчёт сотрудника сразу по обоим направлениям — `useQueries` на два параллельных запроса
 * (`enabled` только когда сотрудник выбран). PRD относит их суммирование к фронтенду ("Не в
 * скоупе": "Суммирование по двум направлениям происходит только на уровне отображения"), сам же
 * контракт отдаёт один отчёт одного направления за раз (`employeeSalaryReportResponseSchema`).
 *
 * Направление, вернувшее `404` (`model/api.ts` превращает его в `data === null`), просто не
 * попадает в `EmployeeReportVM.directions` — это ожидаемое состояние "сотрудник не работает в
 * этом направлении" (см. план, раздел "Модель"), а не ошибка страницы: `errorMessage` реагирует
 * только на настоящие сбои запроса (сеть/5xx), которые `model/api.ts` по-прежнему оборачивает в
 * `ApiError` и пробрасывает.
 */
export function useEmployeeSalaryReport(employeeId: number | null, period: string) {
    const enabled = employeeId != null

    const [serviceResult, shopResult] = useQueries({
        queries: DIRECTIONS.map((direction) => ({
            ...api.getEmployeeSalaryReport(direction, employeeId ?? 0, period),
            enabled,
        })),
    })

    const isInitialLoad = enabled && (serviceResult.isLoading || shopResult.isLoading)
    const isRefreshing = enabled && !isInitialLoad && (serviceResult.isFetching || shopResult.isFetching)
    const errorMessage = enabled ? (serviceResult.error?.message ?? shopResult.error?.message ?? null) : null
    const dataVersion = Math.max(serviceResult.dataUpdatedAt, shopResult.dataUpdatedAt)

    const report = useMemo<EmployeeReportVM | null>(() => {
        if (!enabled || isInitialLoad) return null

        const directions: DirectionReportVM[] = []
        const responses = [serviceResult.data, shopResult.data]
        responses.forEach((data, index) => {
            if (!data) return
            const direction = DIRECTIONS[index]
            directions.push({
                direction,
                label: SALARY_DIRECTION_LABELS[direction],
                isClosed: data.isClosed,
                total: data.total,
                rules: data.rules,
                salesPerformance: data.salesPerformance,
                isPlanApproved: data.isPlanApproved,
                accrualStatus: data.accrualStatus,
            })
        })

        return {
            period,
            directions,
            grandTotal: sumAllFactPrognose(directions.map((d) => d.total)),
            isClosed: directions.length > 0 && directions.every((d) => d.isClosed),
        }
    }, [enabled, isInitialLoad, period, serviceResult.data, shopResult.data])

    return { report, isInitialLoad, isRefreshing, errorMessage, dataVersion }
}

export type UseEmployeeSalaryReportResult = ReturnType<typeof useEmployeeSalaryReport>
