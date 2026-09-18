import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { SalaryAccrualLine, SalesDirection } from 'ireports-contracts'

import { DIRECTION_LABEL } from '@/features/AccountingPeriod'
import {
    countAdjustedLines,
    deriveDocumentProgress,
    deriveLineTaskId,
    pluralizeLines,
    useSalaryAccrual,
} from '@/features/SalaryAccruals'
import { DEFAULT_PERIOD, formatCurrency, formatPeriodLabel, isValidPeriod } from '@/features/SalesPlan'
import { useDepartments } from '@/features/TargetDirectory'

/**
 * Состояние `pages/SalaryAccrualDocument` (Фаза 5 docs/payroll-closing-and-accrual, редизайн
 * `DQ3tV`/`g0onp`): карточка документа начисления. Направление — в query (`?direction=`): GET
 * карточки живёт под префиксом направления (`/v1/{direction}/accounting/salary_accruals/:id`),
 * а путь по плану — `/salary-accruals/:id`; список всегда передаёт направление (и период — для
 * ссылки «Назад к списку» до прихода документа). Блок план/факт отдела (`useSalesPlan`) убран
 * вместе с редизайном — в `DQ3tV`/`g0onp` его нет.
 */
export function useSalaryAccrualDocumentPage() {
    const { id = '' } = useParams()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    const direction: SalesDirection = searchParams.get('direction') === 'shop' ? 'shop' : 'service'
    const rawPeriod = searchParams.get('period')
    const fallbackPeriod = rawPeriod !== null && isValidPeriod(rawPeriod) ? rawPeriod : DEFAULT_PERIOD

    const { document, isInitialLoad, isRefreshing, dataVersion, error } = useSalaryAccrual(direction, id)
    const period = document?.period ?? fallbackPeriod
    const periodLabel = formatPeriodLabel(period)

    const departments = useDepartments()
    const departmentName = useMemo(() => {
        if (document === undefined || document.departmentId === null) return null
        return (
            (departments.data ?? []).find((department) => department.id === document.departmentId)?.name ??
            `Отдел ${document.departmentId}`
        )
    }, [document, departments.data])

    // Детализация строки (источники заказов) — боковая панель, как на странице зарплаты
    // (`pages/SalaryReportV2`'s `RuleGroupDetailsPanel`), а не аккордеон на месте: открытая строка
    // хранится целиком (не только `id`), у панели уже есть все данные (`sources`) без похода в API.
    // Строка типа `TaskCompletion` — исключение (`deriveLineTaskId`): клик по ней ведёт в карточку
    // самой задачи (`TaskDetailsPanel`), а не в детализацию начисления — та же развилка, что и
    // `TaskSourceCard` на странице зарплаты.
    const [openLine, setOpenLine] = useState<SalaryAccrualLine | null>(null)
    const [openTaskId, setOpenTaskId] = useState<string | null>(null)

    function openLineDetails(line: SalaryAccrualLine) {
        const taskId = deriveLineTaskId(line)
        if (taskId !== null) {
            setOpenTaskId(taskId)
            return
        }
        setOpenLine(line)
    }

    const lines = useMemo(() => document?.lines ?? [], [document])
    const progress = useMemo(() => deriveDocumentProgress(lines), [lines])
    const adjustedCount = useMemo(() => countAdjustedLines(lines), [lines])

    const footerNote = `${lines.length} ${pluralizeLines(lines.length)} · начислено ${progress.label} · корректировок: ${adjustedCount}`
    // Мобильный подвал «гроссбуха» короче десктопного (Pencil `g0onp`'s `F3mvxY`: «5 строк ·
    // корректировок: 1», без «начислено X из Y» — оно и так видно по прогрессу «Итого» в шапке).
    const footerNoteMobile = `${lines.length} ${pluralizeLines(lines.length)} · корректировок: ${adjustedCount}`
    const footerTotal = document === undefined ? '' : `Итого ${formatCurrency(document.total)}`

    function goBackToList() {
        navigate(`/salary-accruals?period=${period}&direction=${direction}`)
    }

    return {
        document,
        direction,
        directionLabel: DIRECTION_LABEL[direction],
        period,
        periodLabel,
        departmentName,
        progress,
        openLine,
        openTaskId,
        openLineDetails,
        closeLineDetails: () => setOpenLine(null),
        closeTaskDetails: () => setOpenTaskId(null),
        footerNote,
        footerNoteMobile,
        footerTotal,
        goBackToList,
        isInitialLoad,
        isRefreshing,
        dataVersion,
        error,
    }
}
