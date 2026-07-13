import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { ChartSeriesEntry } from '@/kernel/types'
import { buildSingleSeriesData, fmtCompact, ruFmt } from '@/features/ServicesChart/model/chartFormat.ts'
import type { ChartMode } from '@/features/ServicesChart/model/types.ts'

const sharedAxisProps = {
    tickLine: false as const,
    axisLine: false as const,
    tick: { fontSize: 10, fill: '#9ca3af' },
}

type MiniTooltipProps = Pick<TooltipContentProps<number, string>, 'active' | 'payload' | 'label'> & {
    mode: ChartMode
}

function MiniTooltip({ active, payload, label, mode }: MiniTooltipProps) {
    if (!active || !payload?.length) return null
    const val = mode === 'count' ? payload[0].value : `${ruFmt(Number(payload[0].value))} ₽`
    return (
        <div
            style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 11,
            }}
        >
            <p style={{ color: '#6b7280', marginBottom: 2 }}>{label}</p>
            <p style={{ fontWeight: 600, color: '#111827' }}>{val}</p>
        </div>
    )
}

type Props = {
    series: ChartSeriesEntry
    mode: ChartMode
    color: string
}

export function SeriesCard({ series, mode, color }: Props) {
    const data = buildSingleSeriesData(series, mode)
    const isMoney = mode !== 'count'

    const totalCount = series.breakdown.reduce((s, b) => s + b.count, 0)
    const totalRevenue = series.breakdown.reduce((s, b) => s + b.revenue, 0)
    const weightedPriceSum = series.breakdown.reduce((s, b) => s + b.avgPrice * b.count, 0)
    const avgPrice = totalCount > 0 ? Math.round(weightedPriceSum / totalCount) : 0

    return (
        <div className="border border-gray-100 rounded-lg p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-xs font-medium text-gray-700 truncate" title={series.name}>
                    {series.name}
                </p>
                <div className="flex items-center gap-2 shrink-0 text-xs tabular-nums whitespace-nowrap">
                    <span
                        title="Кол-во продаж"
                        className={
                            mode === 'count'
                                ? 'font-semibold text-gray-900 bg-gray-100 rounded px-1.5 py-0.5'
                                : 'text-gray-300'
                        }
                    >
                        {totalCount} шт
                    </span>
                    <span className="text-gray-200">·</span>
                    <span
                        title="Средний чек"
                        className={
                            mode === 'avgPrice'
                                ? 'font-semibold text-gray-900 bg-gray-100 rounded px-1.5 py-0.5'
                                : 'text-gray-300'
                        }
                    >
                        {fmtCompact(avgPrice)}
                    </span>
                    <span className="text-gray-200">·</span>
                    <span
                        title="Выручка"
                        className={
                            mode === 'revenue'
                                ? 'font-semibold text-gray-900 bg-gray-100 rounded px-1.5 py-0.5'
                                : 'text-gray-300'
                        }
                    >
                        {fmtCompact(totalRevenue)}
                    </span>
                </div>
            </div>
            <ResponsiveContainer width="100%" height={120}>
                <LineChart data={data}>
                    <CartesianGrid vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" {...sharedAxisProps} interval="preserveStartEnd" />
                    <YAxis
                        {...sharedAxisProps}
                        allowDecimals={false}
                        width={isMoney ? 52 : 32}
                        tickFormatter={isMoney ? ruFmt : undefined}
                    />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                    />
                    <Tooltip content={(props) => <MiniTooltip {...props} mode={mode} />} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
