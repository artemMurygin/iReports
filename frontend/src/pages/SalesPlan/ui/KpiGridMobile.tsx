import { Percent, PiggyBank, Target, TrendingUp, Wallet } from 'lucide-react'

import { cn } from '@/shared/lib/tw'
import { KpiCard } from '@/shared/ui-kit/molecules/KpiCard'
import type { SalesPlanTotals } from '@/features/SalesPlan/model/useSalesPlan.ts'
import { formatCurrency, formatPercent, formatPercentPrecise, pluralizeCategories } from '@/features/SalesPlan/model/format.ts'

export type KpiGridMobileProps = {
    totals: SalesPlanTotals
    periodLabel: string
    /** Разбивка «Маржа · прогноз» по направлениям — только на вкладке «Все» (см.
     * `useSalesPlanPage`), иначе `null` и карточка показывает только суммарное число. */
    prognoseMarginByDirection: { service: number; shop: number } | null
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `T0FMcE` -> `JvB6D` (`KPI Grid`) — two
 * rows of two `TeVSB` (`ERP/Mobile/KPI Card`) instances: Выручка·план/Выручка·факт (row 1),
 * Маржа·план/Маржа·факт (row 2). Unlike the desktop `KpiRow` (5 cards), the mobile grid drops
 * "Выручка · прогноз" — matches the design 1:1 (`JvB6D` has exactly 4 children, no forecast
 * card). «Маржа · прогноз» (третья строка) — вне исходного дизайна, добавлена по запросу
 * пользователя вместе с десктопной `KpiRow`.
 *
 * Reuses the same shared `KpiCard` atom as the desktop row rather than introducing a second,
 * pixel-tuned mobile variant for `TeVSB` — its sizing (11.5px label, 18px value, 14px padding
 * vs. `dvsSJ`'s 13px/24px/18px) is close enough not to warrant a separate component.
 */
function KpiGridMobile({ totals, periodLabel, prognoseMarginByDirection, className }: KpiGridMobileProps) {
    const { categoriesCount, planTurnover, factTurnover, planMargin, factMargin, prognoseMargin, prognoseTurnover } =
        totals
    const prognoseMarginNote = prognoseMarginByDirection
        ? `Сервис ${formatCurrency(prognoseMarginByDirection.service)} · Магазин ${formatCurrency(prognoseMarginByDirection.shop)}`
        : `${formatPercentPrecise(prognoseMargin, prognoseTurnover)} от прогнозной выручки`

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
            <KpiCard
                label="Маржа · прогноз"
                value={formatCurrency(prognoseMargin)}
                note={prognoseMarginNote}
                icon={<PiggyBank />}
                tone={prognoseMargin >= planMargin ? 'positive' : 'warning'}
            />
        </div>
    )
}

export { KpiGridMobile }
