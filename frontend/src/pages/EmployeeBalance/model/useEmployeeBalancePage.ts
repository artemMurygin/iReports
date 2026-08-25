import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { BalanceTransaction, BalanceTransactionType, SalesDirection } from 'ireports-contracts'

import { api } from '@/features/EmployeeBalance'
import { api as payoutApi } from '@/features/Payout'
import { formatPeriodLabel } from '@/features/SalesPlan'
import { useDepartments, useEmployees } from '@/features/TargetDirectory'

import { periodToDateRange } from './periodRange.ts'

/**
 * Текущий календарный месяц (`YYYY-MM`) — дефолт фильтра ленты баланса. НЕ переиспользует
 * `DEFAULT_PERIOD` из `features/SalesPlan` (зафиксированный демо-период отчётности,
 * `2026-06`): движения ленты, включая `SALARY_ACCRUAL`, несут `occurredAt` — дату
 * фактического проведения ("сейчас"), а не расчётный период — поэтому дефолт ленты
 * должен быть месяцем по системным часам, иначе свежепроведённые движения не попадают
 * в выборку по умолчанию.
 */
function currentMonthPeriod(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Направление drawer'а «Добавить движение», открываемого одной из двух кнопок шапки —
 * не путать с `SalesDirection` (service/shop) внутри самой формы движения (Фаза 8b/10
 * docs/payroll-closing-and-accrual: баланс общий, service/shop — атрибут происхождения). */
export type NewTransactionKind = 'income' | 'outcome'

/**
 * Состояние `pages/EmployeeBalance` (Фаза 10 docs/payroll-closing-and-accrual): лента
 * общего баланса сотрудника + drawer нового движения + удаление ручного движения без
 * документа ERP. `employeeId` — из `useParams` (маршрут `/balance/employee/:id`, Фаза
 * 8b — без направления в пути). Плоский объект на возврате — конвенция model-хуков
 * (frontend/CLAUDE.md).
 */
export function useEmployeeBalancePage() {
    const { id = '' } = useParams()
    const employeeId = Number(id)

    // ── Фильтры ленты: месяц (Period Chip, как в остальных страницах фичи начислений) +
    // мультиселект типов чипами-переключателями. Конвертация period -> from/to происходит
    // здесь, а не в `features/EmployeeBalance/model/api.ts` — фильтры ленты специфичны
    // для этой страницы, у карточки документа/будущего личного кабинета может быть свой
    // способ их задавать. ─────────────────────────────────────────────────────────────
    const [period, setPeriod] = useState(currentMonthPeriod)
    const [selectedTypes, setSelectedTypes] = useState<readonly BalanceTransactionType[]>([])

    function toggleType(type: BalanceTransactionType) {
        setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]))
    }
    function clearTypes() {
        setSelectedTypes([])
    }

    const { from, to } = useMemo(() => periodToDateRange(period), [period])
    const filters = useMemo(
        () => ({ from, to, types: selectedTypes.length > 0 ? [...selectedTypes] : undefined }),
        [from, to, selectedTypes],
    )

    const balanceQuery = useQuery({
        ...api.getEmployeeBalance(employeeId, filters),
        placeholderData: keepPreviousData,
    })
    const transactions = balanceQuery.data?.transactions ?? []
    const balance = balanceQuery.data?.balance ?? 0
    const selectionTotal = balanceQuery.data?.selectionTotal ?? 0

    // ── ФИО/отдел сотрудника — тот же приём, что `useSalaryAccrualDocumentPage` резолвит
    // отдел документа (справочник Bitrix, не сам ответ баланса — `EmployeeBalanceResponse`
    // несёт только `employeeId`, без имени). ────────────────────────────────────────────
    const employees = useEmployees()
    const departments = useDepartments()

    const employee = useMemo(
        () => (employees.data ?? []).find((item) => item.id === employeeId),
        [employees.data, employeeId],
    )
    const employeeName = employee?.name ?? `Сотрудник ${employeeId}`
    const departmentName = useMemo(() => {
        if (employee === undefined) return null
        return (departments.data ?? []).find((department) => department.id === employee.departmentId)?.name ?? `Отдел ${employee.departmentId}`
    }, [employee, departments.data])
    const employeeNameById = useMemo(
        () => Object.fromEntries((employees.data ?? []).map((item) => [item.id, item.name])),
        [employees.data],
    )

    const periodLabel = formatPeriodLabel(period)

    // ── Drawer «Добавить движение» ──────────────────────────────────────────────────────
    const [isDrawerOpen, setDrawerOpen] = useState(false)
    const [drawerKind, setDrawerKind] = useState<NewTransactionKind>('income')

    function openIncomeDrawer() {
        setDrawerKind('income')
        setDrawerOpen(true)
    }
    function openOutcomeDrawer() {
        setDrawerKind('outcome')
        setDrawerOpen(true)
    }
    function closeDrawer() {
        setDrawerOpen(false)
    }

    // ── Удаление ручного движения ────────────────────────────────────────────────────────
    const [deleteTarget, setDeleteTarget] = useState<BalanceTransaction | null>(null)
    function requestDelete(transaction: BalanceTransaction) {
        setDeleteTarget(transaction)
    }
    function closeDeleteDialog() {
        setDeleteTarget(null)
    }

    // ── Удаление выплаты (Фаза 15 docs/payroll-closing-and-accrual, P3.3) ──────────────────
    const [deletePayoutTarget, setDeletePayoutTarget] = useState<BalanceTransaction | null>(null)
    function requestDeletePayout(transaction: BalanceTransaction) {
        setDeletePayoutTarget(transaction)
    }
    function closeDeletePayoutDialog() {
        setDeletePayoutTarget(null)
    }

    // ── Выплата (Фаза 14 docs/payroll-closing-and-accrual, PRD 3) ──────────────────────────
    // Страница баланса — общая по сотруднику, без Direction Tabs (Фаза 8b) — в отличие от
    // `pages/Payout` (уже per-direction), здесь направление кассы выбирается прямо в
    // `PayoutDrawer` (его собственный `onDirectionChange`, см. компонент).
    const [isPayoutOpen, setIsPayoutOpen] = useState(false)
    const [payoutDirection, setPayoutDirection] = useState<SalesDirection>('service')
    function openPayout() {
        setPayoutDirection('service')
        setIsPayoutOpen(true)
    }
    function closePayout() {
        setIsPayoutOpen(false)
    }
    const erpCashConfigQuery = useQuery({ ...payoutApi.getErpCashConfig(payoutDirection), enabled: isPayoutOpen })
    const payoutCashLabel =
        erpCashConfigQuery.data === undefined
            ? 'Загрузка кассы…'
            : payoutDirection === 'service'
              ? erpCashConfigQuery.data.roappCashboxId !== null
                  ? 'RemOnline · касса Основная'
                  : 'Касса RemOnline не настроена'
              : erpCashConfigQuery.data.moySkladExpenseItemId !== null && erpCashConfigQuery.data.organizationId !== null
                ? 'МойСклад · статья «Зарплата»'
                : 'Касса МойСклад не настроена'

    const isInitialLoad = balanceQuery.isFetching && balanceQuery.data === undefined
    const isRefreshing = balanceQuery.isFetching && !isInitialLoad

    return {
        employeeId,
        employeeName,
        departmentName,
        employeeNameById,
        balance,
        transactions,
        selectionTotal,

        period,
        setPeriod,
        periodLabel,
        selectedTypes,
        toggleType,
        clearTypes,

        isDrawerOpen,
        drawerKind,
        openIncomeDrawer,
        openOutcomeDrawer,
        closeDrawer,

        deleteTarget,
        requestDelete,
        closeDeleteDialog,

        deletePayoutTarget,
        requestDeletePayout,
        closeDeletePayoutDialog,

        isPayoutOpen,
        payoutDirection,
        setPayoutDirection,
        openPayout,
        closePayout,
        payoutCashLabel,
        payoutTransactions: transactions,

        isInitialLoad,
        isRefreshing,
        dataVersion: balanceQuery.dataUpdatedAt,
        error: balanceQuery.error?.message ?? null,
    }
}
