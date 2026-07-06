import type { TooltipContentProps } from 'recharts'

type MiniCardTooltipProps = Pick<TooltipContentProps<number, string>, 'active' | 'payload'>

export function MiniCardTooltip({ active, payload }: MiniCardTooltipProps) {
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
            <span style={{ color: 'var(--muted-foreground)' }}>{entry.payload.date}: </span>
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
}
