import type { Deal } from '@/types/deal.ts'
import {
    CartesianGrid,
    LineChart,
    Line,
    XAxis,
    YAxis,
    ResponsiveContainer,
    Tooltip,
    AreaChart,
    Area,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../shared/ui/card'
import { useMemo, useState } from 'react'
import { CHART_COLORS, C_POSITIVE, C_NEGATIVE, C_NEUTRAL } from '@/shared/constants/chartColors.ts'

const TOP_N = 5

const TOP_COLORS = CHART_COLORS.slice(0, TOP_N)
const MUTED_STROKE = C_NEUTRAL
const TREND_UP = C_POSITIVE
const TREND_DOWN = C_NEGATIVE
const TREND_NEUTRAL = C_NEUTRAL

type LeadsEntry = {
    date: string
    _originalDate: string
    [source: string]: number | string
}

type Tab = 'grid' | 'chart'

// ── data helpers ─────────────────────────────────────────────────────────────

function getDateKey(dateStr: string, period: 'day' | 'week'): string {
    const date = new Date(dateStr)
    if (period === 'day') return dateStr.slice(5, 10).split('-').reverse().join('.')
    const day = date.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(date)
    monday.setDate(date.getDate() + diffToMonday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = (d: Date) =>
        `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
    return `${fmt(monday)}-${fmt(sunday)}`
}

function buildTimeline(deals: Deal[], period: 'day' | 'week'): LeadsEntry[] {
    return deals
        .reduce((result: LeadsEntry[], deal) => {
            const date = getDateKey(deal.createdAt, period)
            const source = deal.leadSource?.name ?? 'Не заполнено'
            let entry = result.find((e) => e.date === date)
            if (!entry) {
                entry = { date, _originalDate: deal.createdAt }
                result.push(entry)
            }
            entry[source] = ((entry[source] as number) ?? 0) + 1
            return result
        }, [])
        .sort((a, b) => new Date(a._originalDate).getTime() - new Date(b._originalDate).getTime())
}

function rankSourcesByTotal(deals: Deal[]): string[] {
    const map = new Map<string, number>()
    deals.forEach((deal) => {
        const s = deal.leadSource?.name ?? 'Не заполнено'
        map.set(s, (map.get(s) ?? 0) + 1)
    })
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
}

// ── mini card ────────────────────────────────────────────────────────────────

interface MiniCardProps {
    source: string
    data: LeadsEntry[]
    globalMax: number
}

function MiniCard({ source, data, globalMax }: MiniCardProps) {
    const pts = data.map((e) => ({ date: e.date, v: (e[source] as number) ?? 0 }))
    const lastVal = pts.at(-1)?.v ?? 0
    const firstVal = pts.at(0)?.v ?? 0
    const pct = firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : null
    const lineColor =
        pct === null ? TREND_NEUTRAL : pct > 0 ? TREND_UP : pct < 0 ? TREND_DOWN : TREND_NEUTRAL

    return (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 min-w-0">
            <span
                className="text-[11px] leading-tight text-muted-foreground truncate"
                title={source}
            >
                {source}
            </span>
            <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-semibold tabular-nums text-foreground">
                    {lastVal.toLocaleString('ru-RU')}
                </span>
                {pct !== null && (
                    <span className="text-[11px] font-medium" style={{ color: lineColor }}>
                        {pct > 0 ? '+' : ''}
                        {pct.toFixed(1)}%
                    </span>
                )}
            </div>
            <ResponsiveContainer width="100%" height={52}>
                <AreaChart data={pts} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
                    <YAxis domain={[0, globalMax || 1]} hide />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const entry = payload[0]
                            return (
                                <div
                                    style={{
                                        background: 'var(--popover)',
                                        border: '1px solid var(--border)',
                                        borderRadius: 6,
                                        padding: '4px 8px',
                                        fontSize: 11,
                                        lineHeight: '1.4',
                                    }}
                                >
                                    <span style={{ color: 'var(--muted-foreground)' }}>
                                        {entry.payload.date}:{' '}
                                    </span>
                                    <span
                                        style={{
                                            fontWeight: 600,
                                            color: 'var(--popover-foreground)',
                                        }}
                                    >
                                        {Number(entry.value).toLocaleString('ru-RU')}
                                    </span>
                                </div>
                            )
                        }}
                    />
                    <Area
                        type="linear"
                        dataKey="v"
                        stroke={lineColor}
                        fill={lineColor}
                        fillOpacity={0.15}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

// ── end-of-line label for focus chart ────────────────────────────────────────

interface EndLabelProps {
    x?: number
    y?: number
    index?: number
    value?: number
    dataLength: number
    label: string
    color: string
}

function EndLabel({ x = 0, y = 0, index = 0, value, dataLength, label, color }: EndLabelProps) {
    if (index !== dataLength - 1 || !value) return <g />
    return (
        <text x={x + 6} y={y} dy={4} fontSize={11} fill={color} textAnchor="start">
            {label}
        </text>
    )
}

// ── main component ───────────────────────────────────────────────────────────

export function DealsOverTimeLinearChart({ deals }: { deals: Deal[] }) {
    const [activeTab, setActiveTab] = useState<Tab>('grid')

    const ranked = useMemo(() => rankSourcesByTotal(deals), [deals])

    const dayData = useMemo(() => buildTimeline(deals, 'day'), [deals])

    const globalMaxDay = useMemo(() => {
        let m = 0
        dayData.forEach((entry) => {
            ranked.forEach((src) => {
                const v = (entry[src] as number) ?? 0
                if (v > m) m = v
            })
        })
        return m
    }, [dayData, ranked])

    const weekData = useMemo(() => buildTimeline(deals, 'week'), [deals])

    const topSources = ranked.slice(0, TOP_N)
    const tailSources = ranked.slice(TOP_N)
    const weekDataLen = weekData.length

    return (
        <Card className="flex-1 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle className="text-base font-semibold text-card-foreground">
                        Лиды во времени
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                        Динамика по рекламным источникам
                    </CardDescription>
                </div>
                <div className="flex items-center rounded-md border border-border bg-muted p-0.5 shrink-0">
                    <button
                        onClick={() => setActiveTab('grid')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                            activeTab === 'grid'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        По дням
                    </button>
                    <button
                        onClick={() => setActiveTab('chart')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                            activeTab === 'chart'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        Топ-{TOP_N} по неделям
                    </button>
                </div>
            </CardHeader>

            <CardContent className="pt-2 pb-4">
                {/* ── TAB: сетка по дням ───────────────────────────────────────── */}
                {activeTab === 'grid' && (
                    <div
                        className="grid gap-3"
                        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}
                    >
                        {ranked.map((source) => (
                            <MiniCard
                                key={source}
                                source={source}
                                data={dayData}
                                globalMax={globalMaxDay}
                            />
                        ))}
                    </div>
                )}

                {/* ── TAB: топ-N по неделям ────────────────────────────────────── */}
                {activeTab === 'chart' && (
                    <div className="flex flex-col gap-2">
                        <ResponsiveContainer width="100%" height={320}>
                            <LineChart
                                data={weekData}
                                margin={{ top: 8, right: 120, bottom: 4, left: 0 }}
                            >
                                <CartesianGrid
                                    vertical={false}
                                    strokeDasharray="3 3"
                                    stroke="var(--border)"
                                />
                                <XAxis
                                    dataKey="date"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 11, fill: MUTED_STROKE }}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 11, fill: MUTED_STROKE }}
                                />

                                {tailSources.map((source) => (
                                    <Line
                                        key={source}
                                        type="linear"
                                        dataKey={source}
                                        stroke={MUTED_STROKE}
                                        strokeWidth={1}
                                        strokeOpacity={0.4}
                                        dot={false}
                                        isAnimationActive={false}
                                    />
                                ))}

                                {topSources.map((source, i) => {
                                    const color = TOP_COLORS[i]
                                    return (
                                        <Line
                                            key={source}
                                            type="linear"
                                            dataKey={source}
                                            stroke={color}
                                            strokeWidth={2}
                                            dot={false}
                                            isAnimationActive={false}
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            label={(props: any) => (
                                                <EndLabel
                                                    x={props.x}
                                                    y={props.y}
                                                    index={props.index}
                                                    value={props.value}
                                                    dataLength={weekDataLen}
                                                    label={source}
                                                    color={color}
                                                />
                                            )}
                                        />
                                    )
                                })}

                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (!active || !payload?.length) return null
                                        const sorted = payload
                                            .filter((p) => (Number(p.value) || 0) > 0)
                                            .sort(
                                                (a, b) =>
                                                    (Number(b.value) || 0) - (Number(a.value) || 0),
                                            )
                                        if (!sorted.length) return null
                                        return (
                                            <div
                                                style={{
                                                    background: 'var(--popover)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 8,
                                                    padding: '8px 12px',
                                                    fontSize: 12,
                                                }}
                                            >
                                                <p
                                                    style={{
                                                        marginBottom: 6,
                                                        fontWeight: 600,
                                                        color: 'var(--popover-foreground)',
                                                    }}
                                                >
                                                    {label}
                                                </p>
                                                {sorted.map((entry) => {
                                                    const key = String(
                                                        entry.dataKey ?? entry.name ?? '',
                                                    )
                                                    const idx = topSources.indexOf(key)
                                                    const dotColor =
                                                        idx >= 0 ? TOP_COLORS[idx] : MUTED_STROKE
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
                                                                    background: dotColor,
                                                                    display: 'inline-block',
                                                                    flexShrink: 0,
                                                                }}
                                                            />
                                                            <span
                                                                style={{
                                                                    color: 'var(--muted-foreground)',
                                                                }}
                                                            >
                                                                {key}:
                                                            </span>
                                                            <span
                                                                style={{
                                                                    fontWeight: 600,
                                                                    color: 'var(--popover-foreground)',
                                                                    marginLeft: 'auto',
                                                                    paddingLeft: 12,
                                                                }}
                                                            >
                                                                {Number(entry.value).toLocaleString(
                                                                    'ru-RU',
                                                                )}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )
                                    }}
                                />
                            </LineChart>
                        </ResponsiveContainer>

                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
                            {ranked.map((source, i) => {
                                const isTop = i < TOP_N
                                const color = isTop ? TOP_COLORS[i] : MUTED_STROKE
                                return (
                                    <div key={source} className="flex items-center gap-1.5">
                                        <span
                                            style={{
                                                width: 24,
                                                height: 2,
                                                backgroundColor: color,
                                                display: 'inline-block',
                                                borderRadius: 1,
                                                opacity: isTop ? 1 : 0.5,
                                            }}
                                        />
                                        <span
                                            className="text-[11px]"
                                            style={{
                                                color: isTop
                                                    ? 'var(--foreground)'
                                                    : 'var(--muted-foreground)',
                                            }}
                                        >
                                            {source}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
