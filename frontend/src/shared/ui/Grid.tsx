import { type ReactNode } from 'react'

interface GridProps {
    cols?: number
    direction?: 'row' | 'col'
    children: ReactNode
    className?: string
}

const COLS_CLASS: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
    7: 'grid-cols-7',
    8: 'grid-cols-8',
    9: 'grid-cols-9',
    10: 'grid-cols-10',
    11: 'grid-cols-11',
    12: 'grid-cols-12',
}

export function Grid({ cols, direction = 'row', children, className }: GridProps) {
    if (direction === 'col') {
        return <div className={`flex flex-col ${className ?? ''}`}>{children}</div>
    }
    const colsClass = cols ? (COLS_CLASS[cols] ?? `grid-cols-${cols}`) : 'grid-cols-1'
    return <div className={`grid ${colsClass} ${className ?? ''}`}>{children}</div>
}
