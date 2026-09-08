import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { MiniCardTooltip } from './Tooltip'

interface MiniCardFooterProps {
    pts: Array<{ date: string; v: number }>
    globalMax: number
    lineColor: string
}

export function Footer({ pts, globalMax, lineColor }: MiniCardFooterProps) {
    return (
        <ResponsiveContainer width="100%" height={52}>
            <AreaChart data={pts} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
                <YAxis domain={[0, globalMax || 1]} hide />
                <Tooltip content={({ active, payload }) => <MiniCardTooltip active={active} payload={payload} />} />
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
    )
}
