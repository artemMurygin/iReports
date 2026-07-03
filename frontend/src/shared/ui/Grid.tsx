import { type ReactNode } from 'react'

interface GridProps {
    cols?: number
    direction?: 'row' | 'col'
    children: ReactNode
    className?: string
}

export function Grid({ cols, children, className }: GridProps) {
    const colsClass = cols ? `grid-cols-${cols}` : 'grid-cols-1'
    return <div className={`grid ${colsClass} ${className ?? ''}`}>{children}</div>
}
