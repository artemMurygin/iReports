import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import type { SalesDirection } from 'ireports-contracts'

import { DIRECTION_LABEL, useAccountingPeriod } from '@/features/AccountingPeriod'
import {
    countByStatus,
    deriveAccrualsSummary,
    filterAccruals,
    pluralizeDocuments,
    useSalaryAccruals,
    type AccrualStatusFilter,
} from '@/features/SalaryAccruals'
import { DEFAULT_PERIOD, formatCurrency, formatPeriodLabel, isValidPeriod } from '@/features/SalesPlan'
import { useDepartments, useEmployees } from '@/features/TargetDirectory'

/**
 * Всё состояние `pages/SalaryAccruals` (Фаза 5 docs/payroll-closing-and-accrual):
 * `direction`/`period` живут в query-строке (`/salary-accruals?period&direction`) —
 * именно такой адрес собирают переход после закрытия месяца и кнопка «Начисления за
 * {месяц}» на странице плана продаж (Фаза 4, `useSalesPlanPage.goToAccruals`), поэтому
 * состояние читается из URL, а не из useState, и страница открывается сразу на нужном
 * месяце. Плоский объект на возврате — конвенция model-хуков (frontend/CLAUDE.md).
 */
export function useSalaryAccrualsPage() {
    const [searchParams, setSearchParams] = useSearchParams()
    const navigate = useNavigate()

    const rawDirection = searchParams.get('direction')
    const direction: SalesDirection = rawDirection === 'shop' ? 'shop' : 'service'
    const rawPeriod = searchParams.get('period')
    const period = rawPeriod !== null && isValidPeriod(rawPeriod) ? rawPeriod : DEFAULT_PERIOD

    function setDirection(next: SalesDirection) {
        setSearchParams(
            (prev) => {
                const params = new URLSearchParams(prev)
                params.set('direction', next)
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

    const accruals = useSalaryAccruals(direction, period)
    const { periodStatus, isClosed } = useAccountingPeriod(direction, period)
    const employees = useEmployees()
    const departments = useDepartments()

    const [statusFilter, setStatusFilter] = useState<AccrualStatusFilter>('ALL')
    const [search, setSearch] = useState('')

    const employeeNameById = useMemo(
        () => Object.fromEntries((employees.data ?? []).map((employee) => [employee.id, employee.name])),
        [employees.data],
    )
    const departmentNameById = useMemo(
        () => Object.fromEntries((departments.data ?? []).map((department) => [department.id, department.name])),
        [departments.data],
    )

    // «Период закрыт · Иван Петров · 01.08.2026 14:20» — та же сборка, что у плана продаж.
    const closedLabel = useMemo(() => {
        if (periodStatus === undefined || periodStatus.status !== 'CLOSED') return null
        const name = periodStatus.closedBy !== null ? employeeNameById[periodStatus.closedBy] : undefined
        const when = periodStatus.closedAt !== null ? format(new Date(periodStatus.closedAt), 'dd.MM.yyyy HH:mm') : null
        return [name ?? (periodStatus.closedBy !== null ? `ID ${periodStatus.closedBy}` : null), when]
            .filter((part): part is string => part !== null)
            .join(' · ')
    }, [periodStatus, employeeNameById])

    const periodLabel = formatPeriodLabel(period)
    const summary = useMemo(() => deriveAccrualsSummary(accruals.items), [accruals.items])
    const statusCounts = useMemo(() => countByStatus(accruals.items), [accruals.items])
    const filteredItems = useMemo(
        () => filterAccruals(accruals.items, statusFilter, search),
        [accruals.items, statusFilter, search],
    )

    const footerNote = `Показано ${filteredItems.length} из ${accruals.items.length} ${pluralizeDocuments(accruals.items.length)} · ${periodLabel} · направление «${DIRECTION_LABEL[direction]}»`
    const footerTotal = `Итого ${formatCurrency(summary.totalAmount)}`

    // Направление — в query документа: GET карточки живёт под префиксом направления,
    // а сам путь по плану — `/salary-accruals/:id` (без направления в сегментах). Период —
    // для ссылки «Назад к списку» и блока план/факт до прихода самого документа.
    function openAccrual(id: string) {
        navigate(`/salary-accruals/${id}?direction=${direction}&period=${period}`)
    }

    function goToSalesPlan() {
        navigate('/sales-plan')
    }

    // Статус периода — часть гейта первичной загрузки: от него зависит сама ветка
    // (empty-state «месяц не закрыт» vs таблица), рисовать их до ответа рано.
    const isInitialLoad = accruals.isInitialLoad || periodStatus === undefined

    return {
        direction,
        setDirection,
        period,
        setPeriod,
        periodLabel,
        isClosed,
        closedLabel,
        items: filteredItems,
        summary,
        statusCounts,
        statusFilter,
        setStatusFilter,
        search,
        setSearch,
        departmentNameById,
        footerNote,
        footerTotal,
        openAccrual,
        goToSalesPlan,
        isInitialLoad,
        isRefreshing: accruals.isRefreshing,
        dataVersion: accruals.dataVersion,
        error: accruals.error,
        periodDirectionLabel: `${periodLabel} · ${DIRECTION_LABEL[direction]}`,
    }
}
