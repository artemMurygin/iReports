import { TrendingUp, Wallet } from 'lucide-react'
import type { FactPrognoseAmount } from 'ireports-contracts'

import { formatCurrency, formatPeriodLabel, formatSignedCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { KpiCard } from '@/shared/ui-kit/molecules/KpiCard'

export type SalaryTotalsKpiProps = {
    grandTotal: FactPrognoseAmount
    isClosed: boolean
    period: string
    className?: string
}

/**
 * Pencil: `t3QCM`'s "KPI Row · Итого" (`s6Nbt`) / `Z0lgF`'s "KPI Row" (`IPGI9`) — сведённый по
 * обоим направлениям итог сотрудника (`EmployeeReportVM.grandTotal`, см. `sumAllFactPrognose`):
 * «Начислено всего · факт» (`tone="positive"`, нота перечисляет направления) и «Прогноз до конца
 * месяца» (нота — знаковая дельта прогноза к факту). Тот же паттерн, что и `DepartmentTotalsKpi`
 * (см. её комментарий) — здесь нота первой карточки перечисляет "Сервис + Магазин", а не число
 * сотрудников.
 *
 * `isClosed` — `true`, только если ВСЕ присутствующие направления закрыты (см.
 * `EmployeeReportVM.isClosed`'s комментарий); в этом случае `grandTotal.prognose` гарантированно
 * `null` (закрытые направления прогноз не считают), поэтому вторая карточка вместо суммы/дельты
 * показывает факт + ноту «Месяц закрыт» (`tone="warning"`).
 */
export function SalaryTotalsKpi({ grandTotal, isClosed, period, className }: SalaryTotalsKpiProps) {
    const periodLabel = formatPeriodLabel(period)
    const prognoseValue = grandTotal.prognose ?? grandTotal.fact
    const delta = grandTotal.prognose !== null ? grandTotal.prognose - grandTotal.fact : 0

    return (
        <div data-slot="salary-totals-kpi" className={cn('flex flex-col gap-3 sm:flex-row', className)}>
            <KpiCard
                label="Начислено всего · факт"
                value={formatCurrency(grandTotal.fact)}
                note={`Сервис + Магазин · ${periodLabel}`}
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
