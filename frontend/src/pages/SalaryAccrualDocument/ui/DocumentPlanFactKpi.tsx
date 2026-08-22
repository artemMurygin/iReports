import { Percent, Target, TrendingUp } from 'lucide-react'

import { formatCurrency, formatPercentPrecise, formatSignedCurrency } from '@/features/SalesPlan'
import { cn } from '@/shared/lib/tw'
import { KpiCard } from '@/shared/ui-kit/molecules/KpiCard'

export type PlanFact = {
    plan: number
    fact: number
    percent: number
}

export type DocumentPlanFactKpiProps = {
    planFact: PlanFact
    directionLabel: string
    periodLabel: string
    className?: string
}

/**
 * Pencil `jb7fL`: компактный блок план/факт отдела, по которому считались процентные
 * правила, — подпись слева + `KpiCard`×3 («План отдела», «Факт отдела», «Выполнение
 * плана»). На мобильном (`wYi5o`) — одна компактная карточка с тремя колонками
 * (План / Факт / Выполнение) вместо трёх полноразмерных KPI.
 */
export function DocumentPlanFactKpi({ planFact, directionLabel, periodLabel, className }: DocumentPlanFactKpiProps) {
    const percentLabel = formatPercentPrecise(planFact.fact, planFact.plan)
    const deltaLabel = `${formatSignedCurrency(planFact.fact - planFact.plan)} к плану`
    const caption = `План / факт отдела · ${directionLabel} · ${periodLabel}`

    return (
        <div data-slot="document-plan-fact" className={className}>
            {/* Десктоп: подпись + 3 KPI-карточки */}
            <div className="hidden items-stretch gap-4 md:flex">
                <span className="flex w-[150px] shrink-0 items-center font-ui text-[13px] leading-snug text-ink-muted">
                    {caption}
                </span>
                <KpiCard label="План отдела" value={formatCurrency(planFact.plan)} note={`выручка · ${periodLabel}`} icon={<Target />} />
                <KpiCard label="Факт отдела" value={formatCurrency(planFact.fact)} note="на момент закрытия" icon={<TrendingUp />} />
                <KpiCard
                    label="Выполнение плана"
                    value={percentLabel}
                    note={deltaLabel}
                    icon={<Percent />}
                    tone={planFact.percent >= 100 ? 'positive' : 'warning'}
                />
            </div>

            {/* Мобильный: одна компактная карточка с тремя колонками */}
            <div className="flex flex-col gap-2.5 rounded-xl border border-hairline bg-surface p-3.5 md:hidden">
                <span className="font-ui text-xs font-semibold text-ink">{caption}</span>
                <div className="flex items-center gap-2.5">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-ui text-[11px] text-ink-muted">План</span>
                        <span className="truncate font-display text-base font-semibold tracking-[-0.3px] text-ink">
                            {formatCurrency(planFact.plan)}
                        </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-ui text-[11px] text-ink-muted">Факт</span>
                        <span className="truncate font-display text-base font-semibold tracking-[-0.3px] text-ink">
                            {formatCurrency(planFact.fact)}
                        </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                        <span className="font-ui text-[11px] text-ink-muted">Выполнение</span>
                        <span
                            className={cn(
                                'font-display text-base font-bold tracking-[-0.3px]',
                                planFact.percent >= 100 ? 'text-ok-ink' : 'text-warn-ink',
                            )}
                        >
                            {percentLabel}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
