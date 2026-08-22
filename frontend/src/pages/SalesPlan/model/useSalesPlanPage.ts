import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { toast } from 'sonner'
import type { SalesDirection } from 'ireports-contracts'

import {
    DEFAULT_DIRECTION,
    DEFAULT_PERIOD,
    formatPeriodLabel,
    formatPeriodMonthName,
    useApproveSalesPlanRows,
    useSalesPlan,
    useSalesPlanSelection,
} from '@/features/SalesPlan'
import {
    ACCOUNTING_PERIOD_QUERY_KEY_PREFIX,
    isPeriodExpired,
    useAccountingPeriod,
    type UnapprovedRowDetails,
} from '@/features/AccountingPeriod'
import { useDepartments, useEmployees } from '@/features/TargetDirectory'

/**
 * Owns all of `SalesPlanPage`'s state: `direction`/`period` selection, the `useSalesPlan` data
 * fetch, category-row selection, the edit-plan modal's open state + resolved edit set, the
 * "Утвердить выбранное" approve flow, and — since Фаза 4 of docs/payroll-closing-and-accrual —
 * the accounting-period block (status query, close/reopen dialogs, «месяц истёк» flag, the
 * post-close navigation to the accruals list). Returned as a flat object (same convention as
 * `useServicesAnalytics`/`useDeals`, see frontend/CLAUDE.md) so `SalesPlanPage` stays purely
 * presentational.
 *
 * `direction`/`period` are owned here (not inside `useSalesPlan`) so `PageHeader`'s Direction
 * Tabs and `PeriodPicker` can drive them — `useSalesPlan` switches its data source internally
 * based on the `direction`/`period` it's given, so the page stays direction/period-agnostic.
 *
 * `editRows` follows the selection-or-all rule the edit modal needs: `selection.selectedCount >
 * 0` -> only the selected rows, otherwise every row currently on screen for this
 * `direction`/`period` — computed here (not inside the modal) since it's the one place that
 * already holds both `rows` and `selection`.
 */
export function useSalesPlanPage() {
    const [direction, setDirection] = useState<SalesDirection>(DEFAULT_DIRECTION)
    const [period, setPeriod] = useState<string>(DEFAULT_PERIOD)
    const { rows, totals, isInitialLoad, isRefreshing, error, dataVersion } = useSalesPlan(direction, period)
    const selection = useSalesPlanSelection(direction, period, rows)
    const periodLabel = formatPeriodLabel(period)
    const hasData = rows.length > 0
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const editRows = selection.selectedCount > 0 ? rows.filter((row) => selection.isSelected(row.plan.id)) : rows

    // ── Расчётный период (Фаза 4 docs/payroll-closing-and-accrual) ──────────────────
    // Статус — `GET .../period/:period` через features/AccountingPeriod; справочники
    // Bitrix (features/TargetDirectory) резолвят `closedBy` в ФИО для пилюли статуса,
    // названия отделов — для перечня неутверждённых строк в диалоге закрытия и ФИО —
    // для перечня документов не в «Черновике» в диалоге переоткрытия. Композиция трёх
    // фич происходит здесь, на уровне страницы: сами фичи друг о друге не знают
    // (кросс-импорты features запрещены линтингом).
    const { periodStatus, isClosed } = useAccountingPeriod(direction, period)
    const employees = useEmployees()
    const departments = useDepartments()
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)
    const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false)

    const employeeNameById = useMemo(
        () => Object.fromEntries((employees.data ?? []).map((employee) => [employee.id, employee.name])),
        [employees.data],
    )
    const departmentNameById = useMemo(
        () => Object.fromEntries((departments.data ?? []).map((department) => [department.id, department.name])),
        [departments.data],
    )
    // Название категории и сумма плана по id строки — обогащение перечня неутверждённых
    // строк в ClosePeriodDialog (close-preview несёт только id/отдел/категорию).
    const unapprovedRowDetailsById = useMemo(
        () =>
            Object.fromEntries(
                rows.map((row): [string, UnapprovedRowDetails] => [
                    row.plan.id,
                    { name: row.categoryName, amount: row.plan.turnover },
                ]),
            ),
        [rows],
    )

    const closedLabel = useMemo(() => {
        if (periodStatus === undefined || periodStatus.status !== 'CLOSED') return null
        const name = periodStatus.closedBy !== null ? employeeNameById[periodStatus.closedBy] : undefined
        const when = periodStatus.closedAt !== null ? format(new Date(periodStatus.closedAt), 'dd.MM.yyyy HH:mm') : null
        return [name ?? (periodStatus.closedBy !== null ? `ID ${periodStatus.closedBy}` : null), when]
            .filter((part): part is string => part !== null)
            .join(' · ')
    }, [periodStatus, employeeNameById])

    // «Начисления за июль» (`a1Mmrh`) и переход после успешного закрытия — один и тот
    // же адрес списка документов начисления месяца (страница появится в Фазе 5 плана).
    const accrualsLabel = `Начисления за ${formatPeriodMonthName(period)}`
    function goToAccruals() {
        navigate(`/salary-accruals?period=${period}&direction=${direction}`)
    }

    // "Утвердить выбранное" (Selection Bar) — approveRows is keyed on `direction` just like
    // useUpdateSalesPlanRows, so switching Сервис/Магазин swaps in the right endpoint
    // (POST .../sales/plan/approve under the matching domain prefix, see
    // useApproveSalesPlanRows). `selectedRows`/`hasApprovable` decide whether the button gets a
    // handler at all: if every currently-selected row is already APPROVED there's nothing to
    // approve, so `onApprove` is left `undefined` and SelectionBar/SelectionBarMobile render it
    // disabled with an explanatory title instead.
    const approveRows = useApproveSalesPlanRows(direction)
    const selectedRows = rows.filter((row) => selection.isSelected(row.plan.id))
    const hasApprovable = selectedRows.some((row) => row.plan.status !== 'APPROVED')

    function handleApprove() {
        const ids = selectedRows.map((row) => row.plan.id)
        if (ids.length === 0) return

        approveRows.mutate(ids, {
            onSuccess: () => {
                toast.success(ids.length === 1 ? 'Категория утверждена' : `Утверждено категорий: ${ids.length}`)
                selection.clear()
            },
            onError: (mutationError) => {
                toast.error('Не удалось утвердить план продаж', { description: mutationError.message })
            },
        })
    }

    // «Утвердить» у строки перечня в диалоге закрытия: то же утверждение, что у Selection
    // Bar, плюс инвалидация close-preview — сводка диалога должна пересчитаться и разблокировать
    // кнопку «Закрыть месяц», когда неутверждённых строк не останется.
    function handleApproveFromCloseDialog(id: string) {
        approveRows.mutate([id], {
            onSuccess: () => {
                toast.success('Категория утверждена')
                void queryClient.invalidateQueries({ queryKey: ACCOUNTING_PERIOD_QUERY_KEY_PREFIX })
            },
            onError: (mutationError) => {
                toast.error('Не удалось утвердить план продаж', { description: mutationError.message })
            },
        })
    }

    function handlePeriodClosed() {
        toast.success(`Месяц ${periodLabel} закрыт — документы начисления созданы`)
        goToAccruals()
    }

    return {
        direction,
        setDirection,
        period,
        setPeriod,
        rows,
        totals,
        isInitialLoad,
        isRefreshing,
        error,
        dataVersion,
        selection,
        periodLabel,
        hasData,
        isEditModalOpen,
        setIsEditModalOpen,
        editRows,
        approveRows,
        hasApprovable,
        handleApprove,
        // Расчётный период
        isPeriodClosed: isClosed,
        closedLabel,
        isExpired: isPeriodExpired(period),
        isCloseDialogOpen,
        setIsCloseDialogOpen,
        isReopenDialogOpen,
        setIsReopenDialogOpen,
        accrualsLabel,
        goToAccruals,
        unapprovedRowDetailsById,
        departmentNameById,
        employeeNameById,
        handleApproveFromCloseDialog,
        handlePeriodClosed,
    }
}
