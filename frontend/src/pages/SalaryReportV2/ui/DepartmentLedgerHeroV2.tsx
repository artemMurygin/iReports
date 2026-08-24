import { Info } from 'lucide-react'
import type { FactPrognoseAmount } from 'ireports-contracts'

import { formatCurrency, formatPeriodLabel, formatSignedCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'

import { pluralizeEmployees } from '@/features/SalaryReportData'

import { getDeltaTone } from '../model/deltaTone.ts'

import { DeltaBadge } from './DeltaBadge.tsx'

export type DepartmentLedgerHeroV2Props = {
    total: FactPrognoseAmount
    employeeCount: number
    departmentName: string | null
    period: string
    isClosed: boolean
    className?: string
}

/**
 * Герой-строка карточки-гроссбуха («Итого», Pencil `U5nJr`/`fCj1g`) — общая сумма отдела слева
 * (факт), прогноз до конца месяца справа с бейджем-дельтой. Замена отдельной `DepartmentTotalsKpi`
 * (две `KpiCard` рядом) старого дизайна — здесь это верхняя строка единой карточки, не отдельный
 * компонент над таблицей.
 */
export function DepartmentLedgerHeroV2({
    total,
    employeeCount,
    departmentName,
    period,
    isClosed,
    className,
}: DepartmentLedgerHeroV2Props) {
    const periodLabel = formatPeriodLabel(period)
    const prognoseValue = total.prognose ?? total.fact
    const delta = total.prognose !== null ? total.prognose - total.fact : 0

    const noteParts = [pluralizeEmployees(employeeCount), departmentName, periodLabel].filter(Boolean)

    return (
        <div
            data-slot="department-ledger-hero-v2"
            className={cn(
                'flex flex-col gap-4 border-b border-hairline p-4 sm:flex-row sm:items-center sm:justify-between md:p-5',
                className,
            )}
        >
            <div className="flex min-w-0 flex-col gap-1">
                <span className="font-ui text-[11px] font-semibold text-ink-muted">Начислено по отделу · факт</span>
                <span className="font-display text-[28px] font-bold tracking-[-0.4px] text-ink">
                    {formatCurrency(total.fact)}
                </span>
                <span className="truncate font-ui text-xs text-ink-muted">{noteParts.join(' · ')}</span>
            </div>

            <div className="flex flex-col gap-1 sm:items-end">
                <span className="flex items-center gap-1.5 font-ui text-[11px] font-semibold text-ink-muted">
                    Прогноз до конца месяца
                    <Info className="size-[13px] shrink-0" />
                </span>
                <span className="font-display text-lg font-bold text-ink-muted md:text-xl">
                    {formatCurrency(prognoseValue)}
                </span>
                <DeltaBadge tone={getDeltaTone(delta, isClosed)}>
                    {isClosed ? 'Месяц закрыт' : `${formatSignedCurrency(delta)} к факту`}
                </DeltaBadge>
            </div>
        </div>
    )
}
