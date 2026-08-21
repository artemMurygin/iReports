import { useState } from 'react'

import { useDepartments, useEmployees } from '@/features/TargetDirectory'

import { useDepartmentSalaryReport } from './useDepartmentSalaryReport.ts'
import { useEmployeeSalaryReport } from './useEmployeeSalaryReport.ts'
import type { SalaryDirection } from './types.ts'

export type SalaryReportScope = 'employee' | 'department'

/** '2026-08' — текущий месяц в формате `YYYY-MM`, который ожидает бэкенд (`PeriodPicker`'s
 * `isValidPeriod`/`shiftPeriod`, `features/SalesPlan/model/format.ts`). Строится из `Date`, а не
 * захардкожен как `DEFAULT_PERIOD` в `features/SalesPlan` — эта страница не привязана к
 * конкретному демо-периоду, дефолт должен оставаться "сейчас" и после смены месяца в календаре. */
function getCurrentPeriod(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Страничный медиатор `/salaries` (конвенция `useXPage`, плоский объект состояния — см.
 * `frontend/CLAUDE.md`, `pages/SalesPlan/model/useSalesPlanPage.ts`). Один роут, один режим
 * просмотра, переключаемый `scope` — "Сотрудник" делает два параллельных запроса
 * (`useEmployeeSalaryReport`, сведение обоих направлений на фронте), "Отдел" — один запрос на
 * выбранное направление (`useDepartmentSalaryReport`); неактивный для текущего `scope` `id`
 * передаётся вниз как `null`, поэтому его запрос(ы) отключены (`enabled: false`) и не делают
 * лишних сетевых обращений в фоне, пока пользователь смотрит другой режим.
 *
 * Разворачивание строк (правило в отчёте сотрудника/отдела, сотрудник в отчёте отдела) — общий
 * локальный `Set`-стейт здесь, а не в каждом презентационном компоненте по отдельности: строка
 * идентифицируется собственным `ruleId`/`employeeId`, и оба режима используют одну и ту же пару
 * хелперов toggle/isExpanded независимо от текущего `scope`.
 */
export function useSalaryReportPage() {
    const [scope, setScope] = useState<SalaryReportScope>('employee')
    const [period, setPeriod] = useState<string>(getCurrentPeriod)
    const [employeeId, setEmployeeId] = useState<number | null>(null)
    const [departmentId, setDepartmentId] = useState<number | null>(null)
    const [direction, setDirection] = useState<SalaryDirection>('service')
    const [expandedRuleKeys, setExpandedRuleKeys] = useState<Set<string>>(new Set())
    const [expandedEmployeeIds, setExpandedEmployeeIds] = useState<Set<number>>(new Set())

    const departmentsQuery = useDepartments()
    const employeesQuery = useEmployees()

    const employeeReportState = useEmployeeSalaryReport(scope === 'employee' ? employeeId : null, period)
    const departmentReportState = useDepartmentSalaryReport(
        scope === 'department' ? departmentId : null,
        direction,
        period,
    )

    function toggleRule(key: string) {
        setExpandedRuleKeys((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    function toggleEmployee(id: number) {
        setExpandedEmployeeIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function isRuleExpanded(key: string) {
        return expandedRuleKeys.has(key)
    }

    function isEmployeeExpanded(id: number) {
        return expandedEmployeeIds.has(id)
    }

    const activeReportState = scope === 'employee' ? employeeReportState : departmentReportState

    return {
        scope,
        setScope,
        period,
        setPeriod,
        employeeId,
        setEmployeeId,
        isEmployeeSelected: employeeId != null,
        departmentId,
        setDepartmentId,
        isDepartmentSelected: departmentId != null,
        direction,
        setDirection,

        employees: employeesQuery.data ?? [],
        isEmployeesLoading: employeesQuery.isLoading,
        departments: departmentsQuery.data ?? [],
        isDepartmentsLoading: departmentsQuery.isLoading,

        isInitialLoad: activeReportState.isInitialLoad,
        isRefreshing: activeReportState.isRefreshing,
        errorMessage: activeReportState.errorMessage,
        dataVersion: activeReportState.dataVersion,

        employeeReport: employeeReportState.report,
        departmentReport: departmentReportState.report,

        toggleRule,
        toggleEmployee,
        isRuleExpanded,
        isEmployeeExpanded,
    }
}

export type SalaryReportPageState = ReturnType<typeof useSalaryReportPage>
