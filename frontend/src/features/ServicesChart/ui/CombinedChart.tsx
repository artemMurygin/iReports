import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { ChartSeriesEntry } from '@/kernel/types'
import { CHART_COLORS } from '@/kernel/chartColors'
import { buildChartData, gradientIdFor, ruFmt } from '@/features/ServicesChart/model/chartFormat.ts'
import type { ChartMode } from '@/features/ServicesChart/model/types.ts'

const sharedAxisProps = {
    tickLine: false as const,
    axisLine: false as const,
    tick: { fontSize: 11, fill: 'var(--color-ink-muted)' },
}

type BigTooltipProps = Pick<TooltipContentProps<number, string>, 'active' | 'payload' | 'label'> & {
    mode: ChartMode
}

function BigTooltip({ active, payload, label, mode }: BigTooltipProps) {
    if (!active || !payload?.length) return null
    const sorted = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
    const isMoney = mode !== 'count'
    return (
        <div className="max-w-[280px] rounded-lg border border-hairline bg-surface px-3 py-2 font-ui text-xs shadow-sm">
            <p className="mb-1.5 font-semibold text-ink">{label}</p>
            {sorted.map((entry) => {
                const key = String(entry.dataKey ?? entry.name ?? '')
                const val = isMoney ? `${ruFmt(Number(entry.value))} ₽` : entry.value
                return (
                    <div key={key} className="mb-0.5 flex items-center gap-1.5">
                        <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ background: entry.color ?? 'transparent' }}
                        />
                        <span className="max-w-[160px] truncate text-ink-muted">{key}:</span>
                        <span className="ml-auto pl-3 font-semibold text-ink">{val}</span>
                    </div>
                )
            })}
        </div>
    )
}

type Props = {
    series: ChartSeriesEntry[]
    mode: ChartMode
}

export function CombinedChart({ series, mode }: Props) {
    const data = buildChartData(series, mode)

    return (
        <ResponsiveContainer width="100%" height={400}>
            {mode === 'count' ? (
                <AreaChart data={data}>
                    <defs>
                        {series.map((s, i) => {
                            const color = CHART_COLORS[i % CHART_COLORS.length]
                            return (
                                <linearGradient key={s.id} id={gradientIdFor(s.id)} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={color} stopOpacity={0.24} />
                                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            )
                        })}
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
                    <XAxis dataKey="label" {...sharedAxisProps} />
                    <YAxis {...sharedAxisProps} allowDecimals={false} />
                    {series.map((s, i) => (
                        <Area
                            key={s.id}
                            type="monotone"
                            dataKey={s.name}
                            stroke={CHART_COLORS[i % CHART_COLORS.length]}
                            fill={`url(#${gradientIdFor(s.id)})`}
                            strokeWidth={2}
                            dot={false}
                            stackId="a"
                        />
                    ))}
                    <Tooltip content={(props) => <BigTooltip {...props} mode={mode} />} />
                </AreaChart>
            ) : (
                <LineChart data={data}>
                    <CartesianGrid vertical={false} stroke="var(--color-hairline)" />
                    <XAxis dataKey="label" {...sharedAxisProps} />
                    <YAxis {...sharedAxisProps} allowDecimals={false} tickFormatter={ruFmt} />
                    {series.map((s, i) => (
                        <Line
                            key={s.id}
                            type="monotone"
                            dataKey={s.name}
                            stroke={CHART_COLORS[i % CHART_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 5 }}
                        />
                    ))}
                    <Tooltip content={(props) => <BigTooltip {...props} mode={mode} />} />
                </LineChart>
            )}
        </ResponsiveContainer>
    )
}
