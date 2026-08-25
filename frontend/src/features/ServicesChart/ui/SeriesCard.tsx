import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { TooltipContentProps, DotItemDotProps } from 'recharts'
import type { ChartSeriesEntry } from '@/kernel/types'
import {
    buildSingleSeriesData,
    fmtCompact,
    formatShortDate,
    gradientIdFor,
    ruFmt,
} from '@/features/ServicesChart/model/chartFormat.ts'
import type { ChartMode } from '@/features/ServicesChart/model/types.ts'

type MiniTooltipProps = Pick<TooltipContentProps<number, string>, 'active' | 'payload' | 'label'> & {
    mode: ChartMode
}

function MiniTooltip({ active, payload, label, mode }: MiniTooltipProps) {
    if (!active || !payload?.length) return null
    const val = mode === 'count' ? payload[0].value : `${ruFmt(Number(payload[0].value))} ₽`
    return (
        <div className="rounded-lg border border-hairline bg-surface px-2.5 py-1.5 font-ui text-[11px] shadow-sm">
            <p className="mb-0.5 text-ink-muted">{label}</p>
            <p className="font-semibold text-ink">{val}</p>
        </div>
    )
}

function statClassName(active: boolean) {
    return active ? 'text-[12.5px] font-bold text-ink' : 'text-[10.5px] text-ink-muted'
}

type Props = {
    series: ChartSeriesEntry
    mode: ChartMode
    color: string
}

export function SeriesCard({ series, mode, color }: Props) {
    const data = buildSingleSeriesData(series, mode)
    const gradientId = gradientIdFor(series.id)
    const lastIndex = data.length - 1
    // Меньше двух точек — обычно узкий диапазон дат при группировке "Месяц"/"Неделя", когда весь
    // выбранный период попадает в один бакет. Тренд по определению требует хотя бы две точки:
    // AreaChart на одной точке с `domain={['dataMin','dataMax']}` (dataMin === dataMax) рисует
    // вырожденный график без видимой линии — просто одинокая точка на пустом фоне, а подписи оси
    // ниже задваивают одну и ту же дату слева и справа. Вместо этого показываем один кружок по
    // центру и подпись даты один раз, не пытаясь нарисовать несуществующий тренд.
    const hasTrend = data.length >= 2

    const totalCount = series.breakdown.reduce((s, b) => s + b.count, 0)
    const totalRevenue = series.breakdown.reduce((s, b) => s + b.revenue, 0)
    const weightedPriceSum = series.breakdown.reduce((s, b) => s + b.avgPrice * b.count, 0)
    const avgPrice = totalCount > 0 ? Math.round(weightedPriceSum / totalCount) : 0

    const firstLabel = series.breakdown.length ? formatShortDate(series.breakdown[0].period) : ''
    const lastLabel = series.breakdown.length
        ? formatShortDate(series.breakdown[series.breakdown.length - 1].period)
        : ''

    return (
        <div className="flex flex-col gap-1.5 rounded-xl border border-hairline bg-surface p-3">
            <div className="flex items-center gap-1.5">
                <span
                    className="h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{ background: color }}
                    aria-hidden
                />
                <p className="truncate font-ui text-[11.5px] font-medium text-ink" title={series.name}>
                    {series.name}
                </p>
            </div>

            <div className="flex items-center justify-between gap-2 font-ui tabular-nums">
                <span className={statClassName(mode === 'count')} title="Кол-во продаж">
                    {totalCount} шт
                </span>
                <span className={statClassName(mode === 'avgPrice')} title="Средний чек">
                    {fmtCompact(avgPrice)}
                </span>
                <span className={statClassName(mode === 'revenue')} title="Выручка">
                    {fmtCompact(totalRevenue)}
                </span>
            </div>

            <div style={{ height: 60 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
                        <defs>
                            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={0.24} />
                                <stop offset="100%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="label" hide />
                        <YAxis hide domain={['dataMin', 'dataMax']} />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={1.8}
                            fill={`url(#${gradientId})`}
                            isAnimationActive={false}
                            dot={(dotProps: DotItemDotProps) => {
                                const { cx, cy, index } = dotProps
                                if (index !== lastIndex || cx == null || cy == null) return <g key={`dot-${index}`} />
                                return (
                                    <circle
                                        key={`dot-${index}`}
                                        cx={cx}
                                        cy={cy}
                                        r={4}
                                        fill={color}
                                        stroke="var(--color-surface)"
                                        strokeWidth={2}
                                    />
                                )
                            }}
                            activeDot={false}
                        />
                        <Tooltip content={(props) => <MiniTooltip {...props} mode={mode} />} cursor={false} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between font-ui text-[9.5px] text-ink-faint">
                <span>{firstLabel}</span>
                <span>{lastLabel}</span>
            </div>
        </div>
    )
}
