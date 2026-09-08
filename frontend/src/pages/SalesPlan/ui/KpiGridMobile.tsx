import { Percent, Target, TrendingUp, Wallet } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { KpiCard } from '@/shared/ui-kit/molecules/KpiCard'
import type { SalesPlanTotals } from '@/features/SalesPlan/model/useSalesPlan.ts'
import { formatCurrency, formatPercent, formatPercentPrecise, pluralizeCategories } from '@/features/SalesPlan/model/format.ts'

export type KpiGridMobileProps = {
    totals: SalesPlanTotals
    periodLabel: string
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `T0FMcE` -> `JvB6D` (`KPI Grid`) — two
 * rows of two `TeVSB` (`ERP/Mobile/KPI Card`) instances: Выручка·план/Выручка·факт (row 1),
 * Маржа·план/Маржа·факт (row 2). Unlike the desktop `KpiRow` (5 cards), the mobile grid drops
 * "Выручка · прогноз" — matches the design 1:1 (`JvB6D` has exactly 4 children, no forecast
 * card).
 *
 * Reuses the same shared `KpiCard` atom as the desktop row rather than introducing a second,
 * pixel-tuned mobile variant for `TeVSB` — its sizing (11.5px label, 18px value, 14px padding
 * vs. `dvsSJ`'s 13px/24px/18px) is close enough not to warrant a separate component.
 */
function KpiGridMobile({ totals, periodLabel, className }: KpiGridMobileProps) {
    const { categoriesCount, planTurnover, factTurnover, planMargin, factMargin } = totals

    return (
        <div data-slot="kpi-grid-mobile" className={cn('grid grid-cols-2 gap-2.5', className)}>
            <KpiCard
                label="Выручка · план"
                value={formatCurrency(planTurnover)}
                note={`${categoriesCount} ${pluralizeCategories(categoriesCount)} · ${periodLabel}`}
                icon={<Target />}
            />
            <KpiCard
                label="Выручка · факт"
                value={formatCurrency(factTurnover)}
                note={`${formatPercent(factTurnover, planTurnover)} от плана`}
                icon={<TrendingUp className="text-brand-strong" />}
                tone="positive"
            />
            <KpiCard
                label="Маржа · план"
                value={formatCurrency(planMargin)}
                note={`${formatPercentPrecise(planMargin, planTurnover)} от плановой выручки`}
                icon={<Percent />}
            />
            <KpiCard
                label="Маржа · факт"
                value={formatCurrency(factMargin)}
                note={`${formatPercent(factMargin, planMargin)} от плана · ${formatPercentPrecise(factMargin, factTurnover)} от выручки`}
                icon={<Wallet />}
            />
        </div>
    )
}

export { KpiGridMobile }
