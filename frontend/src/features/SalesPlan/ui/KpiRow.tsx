import { LineChart, Percent, Target, TrendingUp } from 'lucide-react'

import { KpiCard } from '@/shared/ui-kit/molecules/KpiCard'
import type { SalesPlanTotals } from '@/features/SalesPlan/model/useSalesPlan.ts'
import {
    formatCurrency,
    formatPercent,
    formatPercentPrecise,
    formatSignedCurrency,
    pluralizeCategories,
} from '@/features/SalesPlan/model/format.ts'

/**
 * Pencil: design/sallary-first-iteration.pen, node `iCsFr` (`KPI Row`) — 5 `ERP/Molecule/KPI
 * Card` instances (`IqZFa`/`z1zWQw`/`c1bWB`/`dd29X`/`KyVzV`), `fill_container` each, gap 16:
 * Выручка·план / Выручка·факт / Выручка·прогноз / Маржа·план / Маржа·факт. Values are the
 * sum of `plan`/`fact`/`prognose` `turnover`/`margin` across the filtered rows (see
 * `useSalesPlan`'s `totals`) — the design's Selection Bar / row-count language is
 * mutation-scoped and out of this view-only page, so the notes below are derived purely
 * from the totals instead.
 */
export type KpiRowProps = {
    totals: SalesPlanTotals
    periodLabel: string
    className?: string
}

function KpiRow({ totals, periodLabel, className }: KpiRowProps) {
    const { categoriesCount, planTurnover, factTurnover, prognoseTurnover, planMargin, factMargin } = totals
    const forecastGap = prognoseTurnover - planTurnover

    return (
        <div data-slot="kpi-row" className={className}>
            <div className="flex flex-col gap-4 md:flex-row">
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
                    label="Выручка · прогноз"
                    value={formatCurrency(prognoseTurnover)}
                    note={`${formatPercent(prognoseTurnover, planTurnover)} плана · ${formatSignedCurrency(forecastGap)}`}
                    icon={<LineChart />}
                    tone={forecastGap >= 0 ? 'positive' : 'warning'}
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
                    icon={<Percent />}
                />
            </div>
        </div>
    )
}

export { KpiRow }
