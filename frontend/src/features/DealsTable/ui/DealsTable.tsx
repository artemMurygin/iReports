import { type Deal } from '@/kernel/types'
import { usePagination } from '../model/usePagination'
import { useBitrix24 } from '../model/useBitrix24'
import { TableLayout } from '@/features/DealsTable/ui/TableLayout'
import { TableHeader } from '@/features/DealsTable/ui/TableHeader'
import { TableBody } from '@/features/DealsTable/ui/TableBody'
import { TableRow } from '@/features/DealsTable/ui/TableRow'
import { TablePagination } from '@/features/DealsTable/ui/TablePagination'

interface ServiceDealsTableProps {
    deals: Deal[]
}

export function DealsTable({ deals }: ServiceDealsTableProps) {
    const pagination = usePagination(deals)
    const { openDeal } = useBitrix24()

    return (
        <TableLayout
            total={deals.length}
            header={<TableHeader />}
            body={
                <TableBody
                    paginated={pagination.paginated}
                    renderRow={(deal, idx) => (
                        <TableRow key={deal.id} deal={deal} isEven={idx % 2 === 1} onClick={openDeal} />
                    )}
                />
            }
            footer={
                <TablePagination
                    page={pagination.page}
                    totalPages={pagination.totalPages}
                    total={deals.length}
                    rangeFrom={pagination.rangeFrom}
                    rangeTo={pagination.rangeTo}
                    onPageChange={pagination.setPage}
                />
            }
        />
    )
}
