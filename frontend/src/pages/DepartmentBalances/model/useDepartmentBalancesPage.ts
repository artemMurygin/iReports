import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { api } from '@/features/EmployeeBalance'
import { DEFAULT_PERIOD, formatPeriodLabel, isValidPeriod } from '@/features/SalesPlan'
import { useDepartments } from '@/features/TargetDirectory'

/**
 * Состояние `pages/DepartmentBalances` (Фаза 10 docs/payroll-closing-and-accrual, макет
 * «Баланс · Отдел», Node `IFJW2` десктоп / `iEYMb` мобильный): `departmentId`/`period`
 * живут в query-строке (`/balance/department?departmentId&period=YYYY-MM`) — тот же приём,
 * что у `useSalaryAccrualsPage` (`direction`/`period` в URL, а не `useState`), и тот же
 * `DEFAULT_PERIOD` (`features/SalesPlan`), что там используется для месяца по умолчанию.
 *
 * Отдел не выбран по умолчанию — на фронтенде нет понятия «текущий отдел руководителя»,
 * поэтому `departmentId` стартует `null`, и запрос сводки включён только когда он задан
 * (`enabled`, тот же приём, что `useDepartmentSalaryReport` в `pages/SalaryReport` для
 * своего "неактивного" `id`). Плоский объект на возврате — конвенция model-хуков
 * (frontend/CLAUDE.md).
 *
 * Баланс отдела — сводка ОБЩИХ балансов сотрудников без разбивки по направлениям (Фаза 8b):
 * `getDepartmentBalances` не принимает и не возвращает `direction`, поэтому здесь нет ни
 * состояния направления, ни Direction Tabs, в отличие от `useSalaryAccrualsPage`.
 */
export function useDepartmentBalancesPage() {
    const [searchParams, setSearchParams] = useSearchParams()

    const rawDepartmentId = searchParams.get('departmentId')
    const departmentId = rawDepartmentId !== null && rawDepartmentId !== '' ? Number(rawDepartmentId) : null
    const rawPeriod = searchParams.get('period')
    const period = rawPeriod !== null && isValidPeriod(rawPeriod) ? rawPeriod : DEFAULT_PERIOD

    function setDepartmentId(next: number) {
        setSearchParams(
            (prev) => {
                const params = new URLSearchParams(prev)
                params.set('departmentId', String(next))
                return params
            },
            { replace: true },
        )
    }

    function setPeriod(next: string) {
        setSearchParams(
            (prev) => {
                const params = new URLSearchParams(prev)
                params.set('period', next)
                return params
            },
            { replace: true },
        )
    }

    const departments = useDepartments()
    const enabled = departmentId !== null

    // `departmentId ?? 0` — тот же приём, что `useDepartmentSalaryReport`'s `departmentId ?? 0`:
    // фиктивное значение никогда не идёт в реальный запрос (`enabled: false` пока `departmentId`
    // не выбран), но нужно, чтобы queryOptions() получил число, а не null.
    const balancesQuery = useQuery({
        ...api.getDepartmentBalances(departmentId ?? 0, period),
        enabled,
        placeholderData: keepPreviousData,
    })

    const employees = balancesQuery.data?.employees ?? []
    const totals = balancesQuery.data?.totals ?? { balance: 0, accrued: 0, advances: 0, manual: 0 }
    const periodLabel = formatPeriodLabel(period)

    const isInitialLoad = enabled && balancesQuery.isFetching && balancesQuery.data === undefined
    const isRefreshing = enabled && balancesQuery.isFetching && !isInitialLoad

    return {
        departmentId,
        setDepartmentId,
        period,
        setPeriod,
        periodLabel,

        departments: departments.data ?? [],
        isDepartmentsLoading: departments.isLoading,

        employees,
        totals,

        isInitialLoad,
        isRefreshing,
        dataVersion: balancesQuery.dataUpdatedAt,
        error: enabled ? (balancesQuery.error?.message ?? null) : null,
    }
}
