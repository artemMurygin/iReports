import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/tw'

export type StatusColor = 'success' | 'error' | 'warning' | 'neutral'

const STATUS_COLOR_CLASS: Record<StatusColor, string> = {
    success: 'text-brand-green-dark',
    error: 'text-brand-red',
    warning: 'text-brand-orange',
    neutral: 'text-[#333]',
}

interface StatusLineProps {
    message: string
    color?: StatusColor
    align?: 'center' | 'left'
    className?: string
}

// Reproduces the reference sidebar's #status/#roSummary(text)/#createServicesSummary status
// lines (frontend/GoogleSheetsInterface/index.html lines ~493-506, ~563): small colored text,
// empty by default, reserving its line height so surrounding layout doesn't jump.
export function StatusLine({ message, color = 'neutral', align = 'center', className }: StatusLineProps) {
    return (
        <div
            className={cn(
                'min-h-[18px] text-[13px]',
                align === 'center' ? 'text-center' : 'text-left',
                STATUS_COLOR_CLASS[color],
                className,
            )}
        >
            {message}
        </div>
    )
}

interface SummaryStat {
    label: string
    value: ReactNode
}

interface SummaryBoxProps {
    stats: SummaryStat[]
    hasErrors?: boolean
    className?: string
}

// Reproduces the reference sidebar's bordered summary boxes (#roSummary/#createServicesSummary,
// index.html lines ~478-506): a light-gray box of "label: **value**" lines, the border turning
// brand-orange when the caller reports errors. Renders nothing when there are no stats, matching
// the reference's `display: none` default.
export function SummaryBox({ stats, hasErrors = false, className }: SummaryBoxProps) {
    if (stats.length === 0) return null

    return (
        <div
            className={cn(
                'mt-2.5 rounded-lg border bg-[#f7f9f7] px-3 py-2.5 text-xs leading-[1.7] text-[#333]',
                hasErrors ? 'border-brand-orange' : 'border-[#e0e0e0]',
                className,
            )}
        >
            {stats.map((stat) => (
                <div key={stat.label}>
                    {stat.label}: <b>{stat.value}</b>
                </div>
            ))}
        </div>
    )
}
