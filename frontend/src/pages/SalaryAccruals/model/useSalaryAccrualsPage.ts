import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import type { SalesDirection } from 'ireports-contracts'

import { DIRECTION_LABEL, useAccountingPeriod } from '@/features/AccountingPeriod'
import {
    accrueBatchFromPeriodResponse,
    aggregateAccrueBatch,
    countByStatus,
    deriveAccrualsSummary,
    filterAccruals,
    mergeAccrueBatchRetry,
    pluralizeDocuments,
    readAccrueErrorMessage,
    useAccrualSelection,
    useAccrueDocument,
    useAccruePeriod,
    useSalaryAccruals,
    type AccrualStatusFilter,
    type AccrueBatchResult,
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

    // ── Проведение (Фаза 9 docs/payroll-closing-and-accrual, PRD 2) ─────────────────
    // Selection Bar («Начислить выбранным») и Page Header («Начислить все документы
    // месяца») делят один и тот же результат-модалку — оба сводятся к `AccrueBatchResult`
    // (`accrueBatch.ts`) до того, как дойти до неё. Отбор строк — по `filteredItems`
    // (тому же списку, что видит таблица/Selection Bar), не по полному `accruals.items`.
    const selection = useAccrualSelection(direction, period, filteredItems)
    const accrueDocument = useAccrueDocument(direction)
    const accruePeriod = useAccruePeriod(direction)

    const [isSelectedConfirmOpen, setIsSelectedConfirmOpen] = useState(false)
    const [isPeriodConfirmOpen, setIsPeriodConfirmOpen] = useState(false)
    // `accrueDocument` — одна mutation-инстанция, вызываемая параллельно по несколько раз
    // (Promise.allSettled) — её общий `isPending` не отражает «весь батч ещё не завершён»,
    // поэтому статус отправки батча отслеживается отдельным флагом.
    const [isBatchSubmitting, setIsBatchSubmitting] = useState(false)
    const [periodError, setPeriodError] = useState<string | null>(null)
    const [result, setResult] = useState<AccrueBatchResult | null>(null)
    const [isResultOpen, setIsResultOpen] = useState(false)
    const [isRetrying, setIsRetrying] = useState(false)

    // Не-`PAID` документов в текущем (отфильтрованном) списке — и условие видимости кнопки
    // «Начислить все документы месяца» в Page Header, и число N в её confirm-модалке.
    const nonPaidCount = filteredItems.filter((item) => item.status !== 'PAID').length
    const selectedItems = filteredItems.filter((item) => selection.isSelected(item.id))

    function openSelectedConfirm() {
        if (selection.selectedCount === 0) return
        setIsSelectedConfirmOpen(true)
    }

    function openPeriodConfirm() {
        setPeriodError(null)
        setIsPeriodConfirmOpen(true)
    }

    async function submitSelected() {
        if (selectedItems.length === 0) return
        setIsBatchSubmitting(true)
        const settled = await Promise.allSettled(selectedItems.map((item) => accrueDocument.mutateAsync(item.id)))
        setIsBatchSubmitting(false)
        setIsSelectedConfirmOpen(false)
        setResult(aggregateAccrueBatch(settled, selectedItems))
        setIsResultOpen(true)
        selection.clear()
    }

    function submitPeriod() {
        setPeriodError(null)
        accruePeriod.mutate(period, {
            onSuccess: (response) => {
                setIsPeriodConfirmOpen(false)
                setResult(accrueBatchFromPeriodResponse(response))
                setIsResultOpen(true)
                selection.clear()
            },
            onError: (mutationError) => {
                setPeriodError(readAccrueErrorMessage(mutationError))
            },
        })
    }

    // «Повторить для неудачных» в модалке результата — независимо от того, откуда взялся
    // `result` (Selection Bar или Page Header), повтор всегда идёт через `accrueDocument`
    // на уникальные `accrualId` из `result.failures` (task: «повторно вызывает
    // accrueDocument только для accrualId из failures»).
    async function retryFailures() {
        if (result === null || result.failures.length === 0) return
        const uniqueIds = Array.from(new Set(result.failures.map((failure) => failure.accrualId)))
        const nameById = new Map(result.failures.map((failure) => [failure.accrualId, failure.employeeName]))

        setIsRetrying(true)
        const settled = await Promise.allSettled(uniqueIds.map((id) => accrueDocument.mutateAsync(id)))
        const retryResult = aggregateAccrueBatch(
            settled,
            uniqueIds.map((id) => ({ id, employeeName: nameById.get(id) ?? id })),
        )
        setResult((prev) => (prev === null ? retryResult : mergeAccrueBatchRetry(prev, retryResult)))
        setIsRetrying(false)
    }

    function closeResult() {
        setIsResultOpen(false)
    }

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
        // Проведение (Фаза 9)
        selection,
        nonPaidCount,
        selectedItems,
        isSelectedConfirmOpen,
        openSelectedConfirm,
        closeSelectedConfirm: () => setIsSelectedConfirmOpen(false),
        isPeriodConfirmOpen,
        openPeriodConfirm,
        closePeriodConfirm: () => setIsPeriodConfirmOpen(false),
        isBatchSubmitting,
        periodError,
        isAccruingPeriod: accruePeriod.isPending,
        submitSelected,
        submitPeriod,
        result,
        isResultOpen,
        isRetrying,
        retryFailures,
        closeResult,
    }
}
