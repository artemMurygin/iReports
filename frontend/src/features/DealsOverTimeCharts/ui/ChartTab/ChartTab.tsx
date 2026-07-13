import { CartesianGrid, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { LeadsEntry } from '../../model/types'
import { TOP_N, TOP_COLORS, MUTED_STROKE } from '../../model/config'
import { EndLabel } from './EndLabel'
import { ChartTooltip } from './ChartTooltip'

interface ChartTabProps {
    data: LeadsEntry[]
    ranked: string[]
    topSources: string[]
    tailSources: string[]
    dataLength: number
}

export function ChartTab({ data, ranked, topSources, tailSources, dataLength }: ChartTabProps) {
    return (
        <div className="flex flex-col gap-2">
            <ResponsiveContainer width="100%" height={320}>
                <LineChart data={data} margin={{ top: 8, right: 120, bottom: 4, left: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11, fill: MUTED_STROKE }}
                    />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: MUTED_STROKE }} />

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
                                        dataLength={dataLength}
                                        label={source}
                                        color={color}
                                    />
                                )}
                            />
                        )
                    })}

                    <Tooltip
                        content={({ active, payload, label }) => (
                            <ChartTooltip active={active} label={label} payload={payload} topSources={topSources} />
                        )}
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
                                    color: isTop ? 'var(--foreground)' : 'var(--muted-foreground)',
                                }}
                            >
                                {source}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
