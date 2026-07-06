import type { ReactNode } from 'react'

interface GridTabProps {
    ranked: string[]
    renderItem: (source: string) => ReactNode
}

export function GridTab({ ranked, renderItem }: GridTabProps) {
    return (
        <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}
        >
            {ranked.map((source) => renderItem(source))}
        </div>
    )
}
