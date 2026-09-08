import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { api } from './api.ts'
import type { DepartmentReportVM, SalaryDirection } from './types.ts'

/**
 * Отчёт отдела — прямой `useQuery` на одно направление (в отличие от отчёта сотрудника, отчёт
 * отдела строго однонаправленный на бэкенде, см. `model/api.ts`'s комментарий), включён только
 * когда отдел выбран.
 */
export function useDepartmentSalaryReport(
    departmentId: number | null,
    direction: SalaryDirection,
    period: string,
) {
    const enabled = departmentId != null

    const query = useQuery({
        ...api.getDepartmentSalaryReport(direction, departmentId ?? 0, period),
        enabled,
    })

    const isInitialLoad = enabled && query.isLoading
    const isRefreshing = enabled && !isInitialLoad && query.isFetching
    const errorMessage = enabled ? (query.error?.message ?? null) : null

    const report = useMemo<DepartmentReportVM | null>(() => {
        if (!enabled || !query.data) return null

        const data = query.data
        return {
            period: data.period,
            direction,
            department: data.department,
            isClosed: data.isClosed,
            total: data.total,
            employees: data.employees,
        }
    }, [enabled, direction, query.data])

    return { report, isInitialLoad, isRefreshing, errorMessage, dataVersion: query.dataUpdatedAt }
}

export type UseDepartmentSalaryReportResult = ReturnType<typeof useDepartmentSalaryReport>
