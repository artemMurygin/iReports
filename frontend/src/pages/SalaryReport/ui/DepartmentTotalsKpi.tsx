import { TrendingUp, Wallet } from 'lucide-react'
import type { FactPrognoseAmount } from 'ireports-contracts'

import { formatCurrency, formatPeriodLabel, formatSignedCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { KpiCard } from '@/shared/ui-kit/molecules/KpiCard'

import { pluralizeEmployees } from '../model/pluralizeEmployees.ts'

export type DepartmentTotalsKpiProps = {
    total: FactPrognoseAmount
    employeeCount: number
    period: string
    isClosed: boolean
    className?: string
}

/**
 * Pencil: `b6mfxv`'s "KPI Row" (`etmHR`/`pZ7f7`) — две `KpiCard` отдела: "Начислено по отделу ·
 * факт" (`brand-border`/`ok-ink`-нота "N сотрудников · месяц", `tone="positive"`) и "Прогноз до
 * конца месяца" (нота — знаковая дельта прогноза к факту, "+67 900 ₽ к текущему факту").
 *
 * Закрытый период (`isClosed`) — `total.prognose` всегда `null` (см. `factPrognoseAmountSchema`'s
 * комментарий в контракте): вторая карточка вместо дельты показывает тот же факт и ноту "Месяц
 * закрыт" (`tone="warning"`, чтобы отличаться от обычного мутного текста) — без плейсхолдера
 * "—" вместо суммы, т.к. пустая карточка "0 ₽" выглядела бы как реальный ноль начислений.
 */
export function DepartmentTotalsKpi({ total, employeeCount, period, isClosed, className }: DepartmentTotalsKpiProps) {
    const periodLabel = formatPeriodLabel(period)
    const prognoseValue = total.prognose ?? total.fact
    const delta = total.prognose !== null ? total.prognose - total.fact : 0

    return (
        <div data-slot="department-totals-kpi" className={cn('flex flex-col gap-3 sm:flex-row', className)}>
            <KpiCard
                label="Начислено по отделу · факт"
                value={formatCurrency(total.fact)}
                note={`${pluralizeEmployees(employeeCount)} · ${periodLabel}`}
                icon={<Wallet />}
                tone="positive"
            />
            <KpiCard
                label="Прогноз до конца месяца"
                value={formatCurrency(prognoseValue)}
                note={isClosed ? 'Месяц закрыт' : `${formatSignedCurrency(delta)} к текущему факту`}
                icon={<TrendingUp />}
                tone={isClosed ? 'warning' : 'default'}
            />
        </div>
    )
}
