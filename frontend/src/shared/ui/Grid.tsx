import { type ReactNode } from 'react'

interface GridProps {
    cols: number
    children: ReactNode
    className?: string
}

export function Grid({ cols, children, className }: GridProps) {
    return (
        <div
            className={className}
            style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
            {children}
        </div>
    )
}