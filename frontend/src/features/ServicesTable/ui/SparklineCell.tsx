import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { PeriodBreakdownEntry } from '@/kernel/types'
import { C_POSITIVE } from '@/kernel/chartColors'

interface Props {
    breakdown: PeriodBreakdownEntry[]
}

type SparkTooltipProps = Pick<TooltipContentProps<number, string>, 'active' | 'payload'>

function SparkTooltip({ active, payload }: SparkTooltipProps) {
    if (!active || !payload?.length) return null
    return (
        <div
            style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 4,
                padding: '3px 7px',
                fontSize: 11,
            }}
        >
            {payload[0].payload.period}: <strong>{payload[0].value}</strong>
        </div>
    )
}

export function SparklineCell({ breakdown }: Props) {
    const hasData = breakdown.some((b) => b.count > 0)
    if (!hasData) {
        return <span className="block w-[120px] text-center text-xs text-gray-300">—</span>
    }
    return (
        <ResponsiveContainer width={120} height={36}>
            <LineChart data={breakdown}>
                <Line
                    type="monotone"
                    dataKey="count"
                    stroke={C_POSITIVE}
                    dot={false}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                />
                <Tooltip content={SparkTooltip} />
            </LineChart>
        </ResponsiveContainer>
    )
}
