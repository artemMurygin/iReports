import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { SalesDirection } from 'ireports-contracts'

import { DIRECTION_LABEL } from '@/features/AccountingPeriod'
import {
    countAdjustedLines,
    deriveDocumentProgress,
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

    // Аккордеон источников: развёрнутые строки — Set id строк (как isRuleExpanded в
    // pages/SalaryReport, только id строки документа уникален сам по себе).
    const [expandedLineIds, setExpandedLineIds] = useState<ReadonlySet<string>>(new Set())
    function toggleLine(lineId: string) {
        setExpandedLineIds((prev) => {
            const next = new Set(prev)
            if (next.has(lineId)) next.delete(lineId)
            else next.add(lineId)
            return next
        })
    }
    const isLineExpanded = (lineId: string) => expandedLineIds.has(lineId)

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
        isLineExpanded,
        toggleLine,
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
