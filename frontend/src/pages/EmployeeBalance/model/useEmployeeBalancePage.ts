import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { BalanceTransaction, BalanceTransactionType } from 'ireports-contracts'

import { api } from '@/features/EmployeeBalance'
import { DEFAULT_PERIOD, formatPeriodLabel } from '@/features/SalesPlan'
import { useDepartments, useEmployees } from '@/features/TargetDirectory'

import { api as identityApi } from './api.ts'
import { matchesCommentSearch } from './commentSearch.ts'
import { buildErpLinkageLabel, buildHeaderSubtitle } from './headerInfo.ts'
import { downloadEmployeeBalanceLedgerCsv } from './exportLedgerCsv.ts'
import { periodToDateRange } from './periodRange.ts'

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

    // ── Фильтры ленты (Фаза 8 docs/employee-settlements-page-redesign): период — НЕОБЯЗАТЕЛЬНОЕ
    // сужение поверх дефолтного «за всё время» (`period === null`, ничего не выбрано — это НЕ
    // текущий месяц, как было до Фазы 8). `PeriodPicker` в `BalanceActions` остаётся доступным
    // как дополнительный фильтр (решение задачи из плана: «оставлять ли месячный PeriodPicker» —
    // да, но его дефолт/сброс означает «всё время», а не текущий месяц), как в макете `L73YCK`/
    // `JTc29`, где отдельного элемента периода нет вовсе — там лента сразу «за всё время».
    // Типы — мультиселект чипами-переключателями; конвертация period -> from/to происходит
    // здесь, а не в `features/EmployeeBalance/model/api.ts` — фильтры ленты специфичны
    // для этой страницы, у карточки документа/будущего личного кабинета может быть свой
    // способ их задавать. ─────────────────────────────────────────────────────────────
    const [period, setPeriod] = useState<string | null>(null)
    const [selectedTypes, setSelectedTypes] = useState<readonly BalanceTransactionType[]>([])

    function toggleType(type: BalanceTransactionType) {
        setSelectedTypes((prev) => (prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]))
    }
    function clearTypes() {
        setSelectedTypes([])
    }

    // ── Поиск по комментарию (Фаза 5 docs/employee-settlements-page-redesign) — фильтр ленты
    // клиентский (see `commentSearch.ts` — эндпоинт не поддерживает поиск по комментарию), без
    // debounce. С Фазы 8 лента подгружается порциями — поиск применяется только к УЖЕ
    // ЗАГРУЖЕННЫМ страницам, а не ко всей истории сотрудника (см. WHY в `commentSearch.ts`): это
    // сознательное ограничение этой фазы, а не баг — увеличить охват поиска можно только добавив
    // серверный параметр в контракт (не сделано, эндпоинт не поддерживает поиск по комментарию). ──
    const [commentSearch, setCommentSearch] = useState('')

    const { from, to } = useMemo(
        () => (period === null ? { from: undefined, to: undefined } : periodToDateRange(period)),
        [period],
    )
    const filters = useMemo(
        () => ({ from, to, types: selectedTypes.length > 0 ? [...selectedTypes] : undefined }),
        [from, to, selectedTypes],
    )

    // ── Лента — курсорная пагинация (Фаза 8, бэкенд — Фаза 7): изначально последние 20 движений
    // «за всё время» (или в рамках сужения period/types), `fetchNextPage` подгружает следующие
    // 20 более ранних (см. `TransactionsLedger`/`TransactionsCardList`'s sentinel,
    // `useInfiniteScrollTrigger`). `placeholderData: keepPreviousData` переживает смену фильтра
    // (типы/период) без "схлопывания" уже отрисованной ленты в спиннер. ──────────────────────
    const balanceQuery = useInfiniteQuery({
        ...api.getEmployeeBalance(employeeId, filters),
        placeholderData: keepPreviousData,
    })
    const pages = balanceQuery.data?.pages
    const rawTransactions = useMemo(() => (pages ?? []).flatMap((page) => page.transactions), [pages])
    const balance = pages?.[0]?.balance ?? 0

    // ── Лента, видимая пользователю: сервер уже отфильтровал по периоду/типам (и уже разбил на
    // страницы), поиск по комментарию сужает УЖЕ ЗАГРУЖЕННЫЕ страницы ещё раз на клиенте (см.
    // `commentSearch.ts`). ────────────────────────────────────────────────────────────────────
    const transactions = useMemo(
        () => rawTransactions.filter((transaction) => matchesCommentSearch(transaction, commentSearch)),
        [rawTransactions, commentSearch],
    )
    // «Итого по выборке»: пока поиск по комментарию пуст, берём авторитетное значение бэкенда
    // (`selectionTotal` — сумма ВСЕЙ отфильтрованной по period/types выборки, не только уже
    // подгруженных страниц, см. WHY в contracts/commands/employee-balance.ts) — то же значение
    // повторяется в ответе каждой страницы одного запроса, первой достаточно. Как только
    // появляется текст поиска по комментарию — единственная НАДЁЖНАЯ сумма это сумма уже
    // загруженных и отфильтрованных на клиенте строк (backend не знает о комментарии), поэтому
    // переключаемся на неё — с тем же ограничением "только загруженное", что и у самого поиска.
    const selectionTotal = useMemo(() => {
        if (commentSearch.trim() !== '') {
            return transactions.reduce((sum, transaction) => sum + transaction.amount, 0)
        }
        return pages?.[0]?.selectionTotal ?? 0
    }, [commentSearch, transactions, pages])

    const isFetchingNextPage = balanceQuery.isFetchingNextPage
    const hasNextPage = balanceQuery.hasNextPage
    function loadMoreTransactions() {
        if (balanceQuery.hasNextPage && !balanceQuery.isFetchingNextPage) {
            void balanceQuery.fetchNextPage()
        }
    }

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
        return (
            (departments.data ?? []).find((department) => department.id === employee.departmentId)?.name ??
            `Отдел ${employee.departmentId}`
        )
    }, [employee, departments.data])
    const employeeNameById = useMemo(
        () => Object.fromEntries((employees.data ?? []).map((item) => [item.id, item.name])),
        [employees.data],
    )

    // ── Должность (шапка, Фаза 5) — только в сводке взаиморасчётов (`BalanceSummaryEmployee`,
    // см. WHY в contracts/commands/employee-balance.ts), не в `/v1/directory/employees`. Тот же
    // запрос, что открывает список `pages/EmployeeSettlements` — обычно уже тёплый в кэше после
    // перехода оттуда по клику на строку сотрудника. ────────────────────────────────────────
    const summaryQuery = useQuery(api.getBalanceSummary(DEFAULT_PERIOD, {}))
    const position = summaryQuery.data?.employees.find((item) => item.employeeId === employeeId)?.position ?? null

    // ── Связь с ERP-системами (шапка, Фаза 5) — «связан с RemOnline и МойСкладом», см.
    // `headerInfo.ts`. ────────────────────────────────────────────────────────────────────
    const identitiesQuery = useQuery(identityApi.getEmployeeIdentities(employeeId))
    const erpLinkageLabel = buildErpLinkageLabel(identitiesQuery.data ?? [])
    const headerSubtitle = buildHeaderSubtitle([departmentName, position, erpLinkageLabel])

    // «Всё время» (period === null, дефолт Фазы 8) — своя подпись, formatPeriodLabel ожидает
    // валидный `YYYY-MM` и не умеет null.
    const periodLabel = period === null ? 'Всё время' : formatPeriodLabel(period)

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

    // isFetchingNextPage исключён из обоих флагов (Фаза 8): подгрузка следующей страницы ленты
    // не должна ни показывать полноэкранный спиннер (isInitialLoad — данные уже есть), ни
    // запускать fade/blur всей страницы (isRefreshing, RefreshTransitionLayout) — у неё свой,
    // локальный индикатор в подвале ленты (см. `TransactionsLedger`/`TransactionsCardList`).
    const isInitialLoad = balanceQuery.isFetching && !isFetchingNextPage && balanceQuery.data === undefined
    const isRefreshing = balanceQuery.isFetching && !isFetchingNextPage && !isInitialLoad

    // ── «Выгрузить ленту» (шапка/панель действий, Фаза 5) — CSV уже отфильтрованной (тип +
    // комментарий) выборки `transactions`, см. `exportLedgerCsv.ts`. ──────────────────────────
    function exportLedger() {
        downloadEmployeeBalanceLedgerCsv(employeeId, transactions, employeeNameById)
    }

    return {
        employeeId,
        employeeName,
        departmentName,
        headerSubtitle,
        employeeNameById,
        balance,
        transactions,
        selectionTotal,
        hasNextPage,
        isFetchingNextPage,
        loadMoreTransactions,

        period,
        setPeriod,
        periodLabel,
        selectedTypes,
        toggleType,
        clearTypes,
        commentSearch,
        setCommentSearch,
        exportLedger,

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

        isInitialLoad,
        isRefreshing,
        dataVersion: balanceQuery.dataUpdatedAt,
        error: balanceQuery.error?.message ?? null,
    }
}
