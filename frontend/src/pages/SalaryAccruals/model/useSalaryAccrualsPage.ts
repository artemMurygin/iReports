import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { SalesDirection } from 'ireports-contracts'

import { DIRECTION_LABEL, useAccountingPeriod } from '@/features/AccountingPeriod'
import {
    accrueBatchFromPeriodResponse,
    aggregateAccrueBatch,
    countByStatus,
    deriveAccrualsTotals,
    filterAccruals,
    filterAccrualsByDepartment,
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
import { useDepartments } from '@/features/TargetDirectory'

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

    // Select «Отдел» в Scope Controls (`LvW0I`'s `wQY20`/`DtPgO`'s `U50So`) — новый фильтр,
    // которого не было в исходном списке; `null` — «Все отделы». Тот же query-параметр
    // convention, что `direction`/`period`; по умолчанию (пока пользователь явно не выбрал
    // отдел) параметр в URL отсутствует и дефолт «Розница» подставляется эффектом ниже.
    const rawDepartment = searchParams.get('department')
    const departmentId =
        rawDepartment !== null && rawDepartment !== '' && !Number.isNaN(Number(rawDepartment))
            ? Number(rawDepartment)
            : null

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

    // useCallback (не обычная функция) — стабильная identity нужна, чтобы её можно было
    // безопасно включить в deps эффекта дефолта «Розница» ниже, не вызывая его на каждый рендер
    // (см. тот же приём в `useEmployeeSettlementsPage.ts`).
    const setDepartmentId = useCallback(
        (next: number | null) => {
            setSearchParams(
                (prev) => {
                    const params = new URLSearchParams(prev)
                    if (next === null) params.delete('department')
                    else params.set('department', String(next))
                    return params
                },
                { replace: true },
            )
        },
        [setSearchParams],
    )

    const accruals = useSalaryAccruals(direction, period)
    const { periodStatus, isClosed } = useAccountingPeriod(direction, period)
    const departments = useDepartments()

    // Дефолт «Розница» — тот же паттерн, что и `useEmployeeSettlementsPage.ts`: пока ссылка не
    // задаёт `?department=` явно, ждём загрузки справочника отделов и подставляем «Розницу» по
    // имени (в проекте нет отдельной константы её id). `defaultAppliedRef` — только один раз за
    // жизнь страницы, иначе явный выбор «Все отделы» (тоже убирает параметр из URL) был бы
    // неотличим от «дефолт ещё не применён» и откатывался бы обратно.
    const defaultAppliedRef = useRef(false)
    useEffect(() => {
        if (defaultAppliedRef.current) return
        if (rawDepartment !== null) {
            defaultAppliedRef.current = true
            return
        }
        if (!departments.data) return
        defaultAppliedRef.current = true
        const retail = departments.data.find((department) => department.name === 'Розница')
        if (retail) setDepartmentId(retail.id)
    }, [rawDepartment, departments.data, setDepartmentId])

    const [statusFilter, setStatusFilter] = useState<AccrualStatusFilter>('ALL')
    const [search, setSearch] = useState('')

    const departmentNameById = useMemo(
        () => Object.fromEntries((departments.data ?? []).map((department) => [department.id, department.name])),
        [departments.data],
    )

    const periodLabel = formatPeriodLabel(period)
    const directionLabel = DIRECTION_LABEL[direction]
    const departmentName = departmentId !== null ? (departmentNameById[departmentId] ?? null) : null

    // Select «Отдел» сужает область до статус-фильтра/поиска — оба применяются поверх него, а не
    // независимо, поэтому и «N из M» в подвале таблицы, и счётчики status-чипов (`statusCounts`)
    // считаются уже в границах выбранного отдела.
    const scopedItems = useMemo(
        () => filterAccrualsByDepartment(accruals.items, departmentId),
        [accruals.items, departmentId],
    )
    const statusCounts = useMemo(() => countByStatus(scopedItems), [scopedItems])
    const filteredItems = useMemo(
        () => filterAccruals(scopedItems, statusFilter, search),
        [scopedItems, statusFilter, search],
    )
    // Карточка «Итого» (`AccrualsTotalCard`) считается по уже отфильтрованному (отдел + статус)
    // списку — см. её собственный комментарий.
    const totals = useMemo(() => deriveAccrualsTotals(filteredItems), [filteredItems])

    const footerNote = `Показано ${filteredItems.length} из ${scopedItems.length} ${pluralizeDocuments(scopedItems.length)} · ${periodLabel}`
    const footerTotal = `Итого ${formatCurrency(totals.toAccrueAmount)}`

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
        directionLabel,
        isClosed,
        items: filteredItems,
        totals,
        statusCounts,
        statusFilter,
        setStatusFilter,
        search,
        setSearch,
        departments: departments.data ?? [],
        isDepartmentsLoading: departments.isLoading,
        departmentId,
        setDepartmentId,
        departmentName,
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
