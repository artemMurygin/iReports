import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { PeriodBreakdownEntry } from '@/kernel/types'
import { cn } from '@/shared/lib/tw'

type TrendTooltipProps = Pick<TooltipContentProps<number, string>, 'active' | 'payload'>

function TrendTooltip({ active, payload }: TrendTooltipProps) {
    if (!active || !payload?.length) return null
    return (
        <div className="rounded-[6px] border border-hairline bg-surface px-2 py-1 text-[11px] text-ink shadow-[0px_4px_12px_-2px_rgba(1,3,6,0.12)]">
            {payload[0].payload.period}: <span className="font-semibold">{payload[0].value}</span>
        </div>
    )
}

type Props = {
    breakdown: PeriodBreakdownEntry[]
    /** Уникальный id для `<linearGradient>` — SVG-градиенты одного документа делят один
     * идентификатор-пространство, поэтому у каждой мини-диаграммы на странице (одна на строку
     * таблицы/карточку) должен быть свой, иначе они переопределяют друг друга. */
    gradientId: string
    width?: number | `${number}%`
    height?: number
    showTooltip?: boolean
    className?: string
}

/**
 * Общая заливка-градиент под линией тренда — переиспользуется и десктоп-ячейкой "Тренд"
 * (`SparklineCell.tsx`), и мобильной full-width полоской карточки (`ServiceMobileCard.tsx`), чтобы
 * не дублировать `<AreaChart>`/`<linearGradient>` разметку между ними (Pencil: `h7eHG` → `tmW21`
 * "Table Section" и `aoOaU` → `slnFj` → `UKBWU` "Service List" рисуют один и тот же визуальный
 * стиль мини-графика в обоих местах).
 */
export function TrendSparkline({
    breakdown,
    gradientId,
    width = 120,
    height = 36,
    showTooltip = true,
    className,
}: Props) {
    const hasData = breakdown.some((point) => point.count > 0)
    if (!hasData) {
        return (
            <span className={cn('block text-center text-xs text-ink-faint', className)} style={{ width }}>
                —
            </span>
        )
    }

    return (
        <ResponsiveContainer width={width} height={height} className={className}>
            <AreaChart data={breakdown} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--uikit-brand-strong)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--uikit-brand-strong)" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area
                    type="monotone"
                    dataKey="count"
                    stroke="var(--uikit-brand-strong)"
                    strokeWidth={1.5}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    isAnimationActive={false}
                />
                {showTooltip && <Tooltip content={TrendTooltip} />}
            </AreaChart>
        </ResponsiveContainer>
    )
}
