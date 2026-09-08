import { type ReactNode } from 'react'

type Props = {
    cols?: number
    gap?: number
    height?: string
    children: ReactNode
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

const GAP_CLASS: Record<number, string> = {
    0: 'gap-0',
    1: 'gap-1',
    2: 'gap-2',
    3: 'gap-3',
    4: 'gap-4',
    5: 'gap-5',
    6: 'gap-6',
    8: 'gap-8',
}

export function Grid({ cols, gap, height, children }: Props) {
    const colsClass = (cols && COLS_CLASS[cols]) || 'grid-cols-1'
    const gapClass = (gap && GAP_CLASS[gap]) || 'gap-4'
    const heightClass = height ? height : 'h-full'
    return <div className={`grid ${colsClass} ${gapClass} ${heightClass}`}>{children}</div>
}
