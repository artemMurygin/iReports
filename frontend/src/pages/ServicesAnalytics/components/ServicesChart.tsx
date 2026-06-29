import { useState } from 'react'
import {
    AreaChart,
    Area,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import type { ChartSeriesEntry } from '../types'

type ChartMode = 'count' | 'avgPrice' | 'revenue'

const MODES: { value: ChartMode; label: string }[] = [
    { value: 'count', label: 'Количество' },
    { value: 'avgPrice', label: 'Средний чек' },
    { value: 'revenue', label: 'Выручка' },
]

const TITLES: Record<ChartMode, string> = {
    count: 'Динамика продаж услуг',
    avgPrice: 'Средний чек услуги',
    revenue: 'Выручка по услугам',
}

const DESCRIPTIONS: Record<ChartMode, string> = {
    count: 'Количество продаж по периодам',
    avgPrice: 'Средняя стоимость услуги по периодам, ₽',
    revenue: 'Сумма продаж услуг по периодам, ₽',
}

const COLORS = [
    '#38d97b', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
]

function formatPeriod(period: string): string {
    const parts = period.split('-')
    if (parts.length === 3) return `${parts[2]}.${parts[1]}`
    return `${parts[1]}.${parts[0]}`
}

function getPointValue(b: { count: number; avgPrice: number; revenue: number }, mode: ChartMode): number {
    if (mode === 'count') return b.count
    if (mode === 'avgPrice') return b.avgPrice
    return b.revenue
}

function buildChartData(series: ChartSeriesEntry[], mode: ChartMode) {
    if (!series.length) return []
    const periods = series[0].breakdown.map((b) => b.period)
    return periods.map((period, i) => {
        const row: Record<string, string | number> = { period, label: formatPeriod(period) }
        for (const s of series) {
            row[s.name] = getPointValue(s.breakdown[i] ?? { count: 0, avgPrice: 0, revenue: 0 }, mode)
        }
        return row
    })
}

function buildSingleSeriesData(series: ChartSeriesEntry, mode: ChartMode) {
    return series.breakdown.map((b) => ({
        label: formatPeriod(b.period),
        value: getPointValue(b, mode),
    }))
}

const sharedAxisProps = {
    tickLine: false as const,
    axisLine: false as const,
    tick: { fontSize: 10, fill: '#9ca3af' },
}

const ruFmt = (v: number) => v.toLocaleString('ru-RU')

function MiniTooltip({ active, payload, label, mode }: any) {
    if (!active || !payload?.length) return null
    const val = mode === 'count' ? payload[0].value : `${ruFmt(Number(payload[0].value))} ₽`
    return (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 11 }}>
            <p style={{ color: '#6b7280', marginBottom: 2 }}>{label}</p>
            <p style={{ fontWeight: 600, color: '#111827' }}>{val}</p>
        </div>
    )
}

function fmtCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн ₽`
    if (n >= 1_000) return `${Math.round(n / 1_000)} тыс ₽`
    return `${n.toLocaleString('ru-RU')} ₽`
}

function SingleSeriesChart({ series, mode, color }: { series: ChartSeriesEntry; mode: ChartMode; color: string }) {
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
                        className={mode === 'count' ? 'font-semibold text-gray-900 bg-gray-100 rounded px-1.5 py-0.5' : 'text-gray-300'}
                    >
                        {totalCount} шт
                    </span>
                    <span className="text-gray-200">·</span>
                    <span
                        title="Средний чек"
                        className={mode === 'avgPrice' ? 'font-semibold text-gray-900 bg-gray-100 rounded px-1.5 py-0.5' : 'text-gray-300'}
                    >
                        {fmtCompact(avgPrice)}
                    </span>
                    <span className="text-gray-200">·</span>
                    <span
                        title="Выручка"
                        className={mode === 'revenue' ? 'font-semibold text-gray-900 bg-gray-100 rounded px-1.5 py-0.5' : 'text-gray-300'}
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

function BigTooltip({ active, payload, label, mode }: any) {
    if (!active || !payload?.length) return null
    const sorted = [...payload].sort((a: any, b: any) => (Number(b.value) || 0) - (Number(a.value) || 0))
    const isMoney = mode !== 'count'
    return (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 12, maxWidth: 280 }}>
            <p style={{ marginBottom: 6, fontWeight: 600, color: '#374151' }}>{label}</p>
            {sorted.map((entry: any) => {
                const key = String(entry.dataKey ?? entry.name ?? '')
                const val = isMoney ? `${ruFmt(Number(entry.value))} ₽` : entry.value
                return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color ?? 'transparent', display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{key}:</span>
                        <span style={{ fontWeight: 600, color: '#111827', marginLeft: 'auto', paddingLeft: 12 }}>{val}</span>
                    </div>
                )
            })}
        </div>
    )
}

interface Props {
    series: ChartSeriesEntry[]
}

export function ServicesChart({ series }: Props) {
    const [mode, setMode] = useState<ChartMode>('count')

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                        <CardTitle className="text-base font-semibold text-gray-900">
                            {TITLES[mode]}
                        </CardTitle>
                        <CardDescription className="text-sm text-gray-500">
                            {DESCRIPTIONS[mode]}
                        </CardDescription>
                    </div>
                    <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs shrink-0">
                        {MODES.map((m) => (
                            <button
                                key={m.value}
                                onClick={() => setMode(m.value)}
                                className={`px-3 py-1.5 transition-colors ${mode === m.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
                {series.length > 1 ? (
                    <div className="grid grid-cols-2 gap-3">
                        {series.map((s, i) => (
                            <div key={s.id} className={series.length % 2 !== 0 && i === series.length - 1 ? 'col-span-2' : ''}>
                                <SingleSeriesChart
                                    series={s}
                                    mode={mode}
                                    color={COLORS[i % COLORS.length]}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={400}>
                        {mode === 'count' ? (
                            <AreaChart data={buildChartData(series, mode)}>
                                <CartesianGrid vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="label" {...sharedAxisProps} />
                                <YAxis {...sharedAxisProps} allowDecimals={false} />
                                {series.map((s, i) => (
                                    <Area
                                        key={s.id}
                                        type="monotone"
                                        dataKey={s.name}
                                        stroke={COLORS[i % COLORS.length]}
                                        fill={COLORS[i % COLORS.length]}
                                        fillOpacity={0.15}
                                        strokeWidth={2}
                                        dot={false}
                                        stackId="a"
                                    />
                                ))}
                                <Tooltip content={(props) => <BigTooltip {...props} mode={mode} />} />
                            </AreaChart>
                        ) : (
                            <LineChart data={buildChartData(series, mode)}>
                                <CartesianGrid vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="label" {...sharedAxisProps} />
                                <YAxis
                                    {...sharedAxisProps}
                                    allowDecimals={false}
                                    tickFormatter={ruFmt}
                                />
                                {series.map((s, i) => (
                                    <Line
                                        key={s.id}
                                        type="monotone"
                                        dataKey={s.name}
                                        stroke={COLORS[i % COLORS.length]}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 5 }}
                                    />
                                ))}
                                <Tooltip content={(props) => <BigTooltip {...props} mode={mode} />} />
                            </LineChart>
                        )}
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    )
}
