import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { BalanceTransaction, ErpCashConfigResponse, PayoutBatchResponse, PayoutEmployeeRow, SalesDirection } from 'ireports-contracts'

import {
    HARDCODED_CREATED_BY,
    api,
    countByPayoutStatusFilter,
    filterPayoutRows,
    useCreatePayoutBatch,
    type PayoutStatusFilter,
} from '@/features/Payout'
import { api as balanceApi } from '@/features/EmployeeBalance'
import { DEFAULT_PERIOD, formatPeriodLabel, isValidPeriod } from '@/features/SalesPlan'

import { periodToDateRange } from './periodRange.ts'

/** «Касса: RemOnline · Основная» / «МойСклад · статья «Зарплата»» / «Касса не настроена» —
 * P3.1: подпись read-only, без выбора (Фаза 14). */
function cashLabel(direction: SalesDirection, config: ErpCashConfigResponse | undefined): string {
    if (config === undefined) return 'Загрузка кассы…'
    if (direction === 'service') {
        return config.roappCashboxId !== null ? 'RemOnline · касса Основная' : 'Касса RemOnline не настроена'
    }
    return config.moySkladExpenseItemId !== null && config.organizationId !== null
        ? 'МойСклад · статья «Зарплата»'
        : 'Касса МойСклад не настроена'
}

/**
 * Всё состояние `pages/Payout` (Фаза 14 docs/payroll-closing-and-accrual, PRD 3): `direction`/
 * `period` в query-строке — тот же приём, что `useSalaryAccrualsPage` (глубокие ссылки,
 * переход из плана продаж/начислений возможен в будущем тем же способом). Плоский объект на
 * возврате — конвенция model-хуков (frontend/CLAUDE.md).
 */
export function usePayoutPage() {
    const [searchParams, setSearchParams] = useSearchParams()

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

    const payoutQuery = useQuery({ ...api.getPayoutPage(direction, period), placeholderData: keepPreviousData })
    const erpCashConfigQuery = useQuery(api.getErpCashConfig(direction))
    const rows = useMemo(() => payoutQuery.data?.employees ?? [], [payoutQuery.data])
    const totals = payoutQuery.data?.totals

    const [statusFilter, setStatusFilter] = useState<PayoutStatusFilter>('ALL')
    const [search, setSearch] = useState('')

    const statusCounts = useMemo(() => countByPayoutStatusFilter(rows), [rows])
    const filteredRows = useMemo(() => filterPayoutRows(rows, statusFilter, search), [rows, statusFilter, search])

    const periodLabel = formatPeriodLabel(period)

    // ── KPI (P3.1) ───────────────────────────────────────────────────────────────────────
    const kpi = useMemo(() => {
        const outstanding = rows.filter((row) => row.balance > 0).reduce((sum, row) => sum + row.balance, 0)
        const paidThisMonth = rows.reduce((sum, row) => sum + row.paid, 0)
        const notPaidCount = rows.filter((row) => row.payoutStatus !== 'PAID').length
        const negativeCount = rows.filter((row) => row.balance < 0).length
        return { outstanding, paidThisMonth, notPaidCount, negativeCount }
    }, [rows])

    // ── Выбор строк (Selection Bar) — локальный, простой Set: уже PAID нельзя выбрать. ─────
    const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
    const resetKey = `${direction}:${period}`
    const [prevResetKey, setPrevResetKey] = useState(resetKey)
    if (resetKey !== prevResetKey) {
        setPrevResetKey(resetKey)
        setSelectedIds(new Set())
    }
    const selectableIds = useMemo(
        () => filteredRows.filter((row) => row.payoutStatus !== 'PAID').map((row) => row.employeeId),
        [filteredRows],
    )
    const isAllSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id))
    const isIndeterminate = selectedIds.size > 0 && !isAllSelected
    function toggleRow(employeeId: number) {
        if (!selectableIds.includes(employeeId)) return
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(employeeId)) next.delete(employeeId)
            else next.add(employeeId)
            return next
        })
    }
    function toggleAll() {
        setSelectedIds(isAllSelected ? new Set() : new Set(selectableIds))
    }
    function clearSelection() {
        setSelectedIds(new Set())
    }
    const selectedRows = filteredRows.filter((row) => selectedIds.has(row.employeeId))

    // ── Drawer «Выплата сотруднику» (одиночная, P3.2) ───────────────────────────────────────
    const [payoutTarget, setPayoutTarget] = useState<PayoutEmployeeRow | null>(null)
    function openPayoutDrawer(row: PayoutEmployeeRow) {
        setPayoutTarget(row)
    }
    function closePayoutDrawer() {
        setPayoutTarget(null)
    }
    const { from: ledgerFrom, to: ledgerTo } = useMemo(() => periodToDateRange(period), [period])
    const ledgerQuery = useQuery({
        ...balanceApi.getEmployeeBalance(payoutTarget?.employeeId ?? 0, { from: ledgerFrom, to: ledgerTo }),
        enabled: payoutTarget !== null,
    })

    // ── Удаление выплаты со строки (Фаза 15 docs/payroll-closing-and-accrual, P3.3) ────────
    // Ответ страницы не несёт id движения PAYOUT (агрегат по сотруднику) — на клик находим
    // движение через ленту баланса (те же from/to, что у `ledgerQuery` выше), отфильтрованную
    // по типу PAYOUT и направлению страницы, берём самое позднее. Одна выплата на период —
    // обычный случай; если их несколько, `DELETE .../payout/:id` в любом случае возвращает
    // в ACCRUED все PAID-документы направления, а не только связанные с конкретной выплатой
    // (см. заметку проверки Фазы 12), так что выбор «последней» не теряет точности относительно
    // самого бэкенда.
    const queryClient = useQueryClient()
    const [deletePayoutTarget, setDeletePayoutTarget] = useState<BalanceTransaction | null>(null)
    const [isResolvingDeletePayout, setIsResolvingDeletePayout] = useState(false)

    async function requestDeletePayout(row: PayoutEmployeeRow) {
        setIsResolvingDeletePayout(true)
        try {
            const response = await queryClient.fetchQuery(
                balanceApi.getEmployeeBalance(row.employeeId, { from: ledgerFrom, to: ledgerTo, types: ['PAYOUT'] }),
            )
            const payouts = response.transactions
                .filter((transaction) => transaction.type === 'PAYOUT' && transaction.direction === direction)
                .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
            if (payouts.length === 0) {
                toast.error('Не найдено движений выплаты за выбранный период')
                return
            }
            setDeletePayoutTarget(payouts[0])
        } finally {
            setIsResolvingDeletePayout(false)
        }
    }
    function closeDeletePayoutDialog() {
        setDeletePayoutTarget(null)
    }

    // ── Массовая выплата (Selection Bar, P3.1) ──────────────────────────────────────────────
    const createPayoutBatch = useCreatePayoutBatch(direction)

    const [isBatchConfirmOpen, setIsBatchConfirmOpen] = useState(false)
    const [confirmNegativeBalance, setConfirmNegativeBalance] = useState(false)
    const [batchError, setBatchError] = useState<string | null>(null)
    const [result, setResult] = useState<PayoutBatchResponse | null>(null)
    const [isResultOpen, setIsResultOpen] = useState(false)
    const [isRetrying, setIsRetrying] = useState(false)

    function openBatchConfirm() {
        if (selectedRows.length === 0) return
        setConfirmNegativeBalance(false)
        setBatchError(null)
        setIsBatchConfirmOpen(true)
    }
    function closeBatchConfirm() {
        setIsBatchConfirmOpen(false)
    }

    function submitBatch() {
        setBatchError(null)
        createPayoutBatch.mutate(
            {
                employeeIds: selectedRows.map((row) => row.employeeId),
                createdBy: HARDCODED_CREATED_BY,
                confirmNegativeBalance: confirmNegativeBalance || undefined,
            },
            {
                onSuccess: (response) => {
                    setIsBatchConfirmOpen(false)
                    setResult(response)
                    setIsResultOpen(true)
                    clearSelection()
                },
                onError: () => {
                    setBatchError('Не удалось выполнить массовую выплату, попробуйте ещё раз')
                },
            },
        )
    }

    async function retryFailures() {
        if (result === null) return
        const retryIds = result.outcomes
            .filter((outcome) => outcome.status === 'FAILED' || outcome.status === 'NEEDS_CONFIRMATION')
            .map((outcome) => outcome.employeeId)
        if (retryIds.length === 0) return

        setIsRetrying(true)
        try {
            const retryResult = await createPayoutBatch.mutateAsync({
                employeeIds: retryIds,
                createdBy: HARDCODED_CREATED_BY,
                confirmNegativeBalance: true,
            })
            setResult((prev) => {
                if (prev === null) return retryResult
                const merged = prev.outcomes.map(
                    (outcome) => retryResult.outcomes.find((next) => next.employeeId === outcome.employeeId) ?? outcome,
                )
                return {
                    direction: retryResult.direction,
                    outcomes: merged,
                    paidCount: merged.filter((outcome) => outcome.status === 'PAID').length,
                    totalPaidAmount: merged.reduce((sum, outcome) => sum + (outcome.amount ?? 0), 0),
                }
            })
        } finally {
            setIsRetrying(false)
        }
    }

    function closeResult() {
        setIsResultOpen(false)
    }

    const isInitialLoad = payoutQuery.isFetching && payoutQuery.data === undefined

    return {
        direction,
        setDirection,
        period,
        setPeriod,
        periodLabel,
        cashLabel: cashLabel(direction, erpCashConfigQuery.data),
        rows: filteredRows,
        totals,
        statusFilter,
        setStatusFilter,
        statusCounts,
        search,
        setSearch,
        kpi,

        selectedIds,
        selectedRows,
        isAllSelected,
        isIndeterminate,
        toggleRow,
        toggleAll,
        clearSelection,

        payoutTarget,
        openPayoutDrawer,
        closePayoutDrawer,
        ledgerTransactions: ledgerQuery.data?.transactions ?? [],

        deletePayoutTarget,
        requestDeletePayout: (row: PayoutEmployeeRow) => void requestDeletePayout(row),
        closeDeletePayoutDialog,
        isResolvingDeletePayout,

        isBatchConfirmOpen,
        openBatchConfirm,
        closeBatchConfirm,
        confirmNegativeBalance,
        setConfirmNegativeBalance,
        isBatchSubmitting: createPayoutBatch.isPending,
        batchError,
        submitBatch,

        result,
        isResultOpen,
        isRetrying,
        retryFailures: () => void retryFailures(),
        closeResult,

        isInitialLoad,
        isRefreshing: payoutQuery.isFetching && !isInitialLoad,
        dataVersion: payoutQuery.dataUpdatedAt,
        error: payoutQuery.error?.message ?? null,
    }
}
