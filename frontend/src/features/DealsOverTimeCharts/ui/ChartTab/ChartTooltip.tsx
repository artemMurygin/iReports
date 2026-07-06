import type { TooltipContentProps } from 'recharts'
import { TOP_COLORS, MUTED_STROKE } from '../../model/config'

interface ChartTooltipProps extends Pick<TooltipContentProps<number, string>, 'active' | 'payload' | 'label'> {
    topSources: string[]
}

export function ChartTooltip({ active, label, payload, topSources }: ChartTooltipProps) {
    if (!active || !payload?.length) return null

    const sorted = payload
        .filter((p) => (Number(p.value) || 0) > 0)
        .sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))

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
                const key = String(entry.dataKey ?? entry.name ?? '')
                const idx = topSources.indexOf(key)
                const dotColor = idx >= 0 ? TOP_COLORS[idx] : MUTED_STROKE
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
                        <span style={{ color: 'var(--muted-foreground)' }}>{key}:</span>
                        <span
                            style={{
                                fontWeight: 600,
                                color: 'var(--popover-foreground)',
                                marginLeft: 'auto',
                                paddingLeft: 12,
                            }}
                        >
                            {Number(entry.value).toLocaleString('ru-RU')}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}
