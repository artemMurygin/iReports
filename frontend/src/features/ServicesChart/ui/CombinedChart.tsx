import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { ChartSeriesEntry } from '@/kernel/types'
import { CHART_COLORS } from '@/kernel/chartColors'
import { buildChartData, ruFmt } from '@/features/ServicesChart/model/chartFormat.ts'
import type { ChartMode } from '@/features/ServicesChart/model/types.ts'

const sharedAxisProps = {
    tickLine: false as const,
    axisLine: false as const,
    tick: { fontSize: 10, fill: '#9ca3af' },
}

type BigTooltipProps = Pick<TooltipContentProps<number, string>, 'active' | 'payload' | 'label'> & {
    mode: ChartMode
}

function BigTooltip({ active, payload, label, mode }: BigTooltipProps) {
    if (!active || !payload?.length) return null
    const sorted = [...payload].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))
    const isMoney = mode !== 'count'
    return (
        <div
            style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
                maxWidth: 280,
            }}
        >
            <p style={{ marginBottom: 6, fontWeight: 600, color: '#374151' }}>{label}</p>
            {sorted.map((entry) => {
                const key = String(entry.dataKey ?? entry.name ?? '')
                const val = isMoney ? `${ruFmt(Number(entry.value))} ₽` : entry.value
                return (
                    <div
                        key={key}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            marginBottom: 3,
                        }}
                    >
                        <span
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: entry.color ?? 'transparent',
                                display: 'inline-block',
                                flexShrink: 0,
                            }}
                        />
                        <span
                            style={{
                                color: '#6b7280',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 160,
                            }}
                        >
                            {key}:
                        </span>
                        <span
                            style={{
                                fontWeight: 600,
                                color: '#111827',
                                marginLeft: 'auto',
                                paddingLeft: 12,
                            }}
                        >
                            {val}
                        </span>
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
                    <CartesianGrid vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" {...sharedAxisProps} />
                    <YAxis {...sharedAxisProps} allowDecimals={false} />
                    {series.map((s, i) => (
                        <Area
                            key={s.id}
                            type="monotone"
                            dataKey={s.name}
                            stroke={CHART_COLORS[i % CHART_COLORS.length]}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                            fillOpacity={0.15}
                            strokeWidth={2}
                            dot={false}
                            stackId="a"
                        />
                    ))}
                    <Tooltip content={(props) => <BigTooltip {...props} mode={mode} />} />
                </AreaChart>
            ) : (
                <LineChart data={data}>
                    <CartesianGrid vertical={false} stroke="#f3f4f6" />
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
