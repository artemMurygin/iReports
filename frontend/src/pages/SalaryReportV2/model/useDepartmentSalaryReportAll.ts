import { useMemo } from 'react'

import {
    sumFactPrognose,
    useDepartmentSalaryReport,
    type DepartmentReportVM,
    type SalaryDirection,
    type SalaryReportRuleWithDirection,
} from '@/features/SalaryReportData'

/** Фильтр направления отчёта отдела на `/salaries` — расширяет `SalaryDirection` вкладкой
 * «Все» (только эта страница, см. `SalaryReportFiltersV2`'s `DIRECTION_OPTIONS`); это же значение
 * идёт в `DepartmentReportVM.direction` сведённого отчёта. */
export type DepartmentDirectionFilter = SalaryDirection | 'all'

type MergedEmployee = {
    employeeId: number
    name: string
    total: { fact: number; prognose: number | null }
    rules: SalaryReportRuleWithDirection[]
}

/**
 * Отчёт отдела по обоим направлениям сразу (вкладка «Все»). Бэкенд отдаёт отчёт отдела строго
 * однонаправленным — кросс-доменное сведение с `shop` в нём было и сознательно удалено (см.
 * `get-department-salary-report.service.ts`'s комментарий: домены `service`/`shop` держатся
 * "зеркальными, но независимыми"). Поэтому для «Все» здесь используется тот же приём, что уже
 * применяется для отчёта СОТРУДНИКА (`useEmployeeSalaryReport`) — два параллельных запроса на
 * каждое направление и сведение сумм на уровне отображения; бэкенд не меняется и продолжает
 * отдавать каждое направление независимо.
 *
 * При одиночном направлении (`'service'`/`'shop'`) просто пробрасывает соответствующий запрос без
 * какой-либо трансформации — тот же результат, что вернул бы `useDepartmentSalaryReport` напрямую.
 */
export function useDepartmentSalaryReportAll(
    departmentId: number | null,
    directionFilter: DepartmentDirectionFilter,
    period: string,
) {
    const serviceState = useDepartmentSalaryReport(directionFilter !== 'shop' ? departmentId : null, 'service', period)
    const shopState = useDepartmentSalaryReport(directionFilter !== 'service' ? departmentId : null, 'shop', period)

    const isInitialLoad =
        directionFilter === 'service'
            ? serviceState.isInitialLoad
            : directionFilter === 'shop'
              ? shopState.isInitialLoad
              : serviceState.isInitialLoad || shopState.isInitialLoad
    const isRefreshing =
        directionFilter === 'service'
            ? serviceState.isRefreshing
            : directionFilter === 'shop'
              ? shopState.isRefreshing
              : !isInitialLoad && (serviceState.isRefreshing || shopState.isRefreshing)
    const errorMessage =
        directionFilter === 'service'
            ? serviceState.errorMessage
            : directionFilter === 'shop'
              ? shopState.errorMessage
              : (serviceState.errorMessage ?? shopState.errorMessage)
    const dataVersion =
        directionFilter === 'service'
            ? serviceState.dataVersion
            : directionFilter === 'shop'
              ? shopState.dataVersion
              : Math.max(serviceState.dataVersion, shopState.dataVersion)

    const report = useMemo<DepartmentReportVM | null>(() => {
        if (directionFilter === 'service') return serviceState.report
        if (directionFilter === 'shop') return shopState.report
        if (isInitialLoad) return null

        const service = serviceState.report
        const shop = shopState.report
        if (!service && !shop) return null

        // Своя копия каждого сотрудника (`{ ...employee.total }`, не ссылка на объект из ответа
        // запроса) — `employeesById`-запись мутируется ниже (`existing.total =`/`existing.rules =`
        // при пересечении сотрудника в обоих направлениях), а значения, возвращённые хуком
        // (`serviceState.report`/`shopState.report`), мутировать нельзя (`react-hooks/immutability`).
        const employeesById = new Map<number, MergedEmployee>()

        for (const employee of service?.employees ?? []) {
            const taggedRules: SalaryReportRuleWithDirection[] = employee.rules.map((rule) => ({ ...rule, direction: 'service' }))
            employeesById.set(employee.employeeId, {
                employeeId: employee.employeeId,
                name: employee.name,
                total: { ...employee.total },
                rules: taggedRules,
            })
        }

        for (const employee of shop?.employees ?? []) {
            const taggedRules: SalaryReportRuleWithDirection[] = employee.rules.map((rule) => ({ ...rule, direction: 'shop' }))
            const existing = employeesById.get(employee.employeeId)
            if (existing) {
                existing.total = sumFactPrognose(existing.total, employee.total)
                existing.rules = [...existing.rules, ...taggedRules]
            } else {
                employeesById.set(employee.employeeId, {
                    employeeId: employee.employeeId,
                    name: employee.name,
                    total: { ...employee.total },
                    rules: taggedRules,
                })
            }
        }

        return {
            period: (service ?? shop)?.period ?? period,
            direction: 'all',
            department: (service ?? shop)?.department ?? departmentId ?? 0,
            // "Месяц закрыт" целиком — только если закрыты ОБА присутствующих направления (тот же
            // принцип, что и у `EmployeeReportVM.isClosed`, см. `types.ts`); отсутствующее
            // направление (нет отчёта вовсе) не должно блокировать закрытие смешанного отчёта.
            isClosed: (service?.isClosed ?? true) && (shop?.isClosed ?? true),
            total: sumFactPrognose(service?.total ?? { fact: 0, prognose: 0 }, shop?.total ?? { fact: 0, prognose: 0 }),
            employees: Array.from(employeesById.values()),
        }
    }, [directionFilter, isInitialLoad, serviceState.report, shopState.report, departmentId, period])

    return { report, isInitialLoad, isRefreshing, errorMessage, dataVersion }
}

export type UseDepartmentSalaryReportAllResult = ReturnType<typeof useDepartmentSalaryReportAll>
