import { type ReactNode } from 'react'
import { type Deal } from '@/kernel/types'
import { TableRow } from './TableRow'

interface TableBodyProps {
    paginated: Deal[]
    renderRow?: (deal: Deal, index: number) => ReactNode
}

export function TableBody({
 paginated, renderRow 
}: TableBodyProps) {
    if (paginated.length === 0) {
        return (
            <div className="flex items-center justify-center h-16 text-sm text-gray-400">
                Нет данных
            </div>
        )
    }

    return (
        <>
            {paginated.map((deal, idx) =>
                renderRow ? (
                    renderRow(deal, idx)
                ) : (
                    <TableRow key={deal.id} deal={deal} isEven={idx % 2 === 1} />
                ),
            )}
        </>
    )
}
