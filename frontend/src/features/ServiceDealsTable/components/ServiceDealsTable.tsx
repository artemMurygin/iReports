import { type Deal } from '@/types/deal'
import { ServiceDealsTableContext } from '../context'
import { usePagination } from '../hooks/usePagination'
import { useBX24 } from '../hooks/useBX24'
import { TableLayout } from '../components/TableLayout'
import { TableHeader } from '../components/TableHeader'
import { TableBody } from '../components/TableBody'
import { TableRow } from '../components/TableRow'
import { TablePagination } from '../components/TablePagination'

interface ServiceDealsTableProps {
    deals: Deal[]
}

function Root({ deals }: ServiceDealsTableProps) {
    const pagination = usePagination(deals)
    const { openDeal } = useBX24()

    return (
        <ServiceDealsTableContext.Provider value={{ openDeal }}>
            <TableLayout
                total={deals.length}
                header={<TableHeader />}
                body={
                    <TableBody
                        paginated={pagination.paginated}
                        renderRow={(deal, idx) => (
                            <TableRow key={deal.id} deal={deal} isEven={idx % 2 === 1} />
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
        </ServiceDealsTableContext.Provider>
    )
}

export const ServiceDealsTable = Object.assign(Root, {
    Layout: TableLayout,
    Header: TableHeader,
    Body: TableBody,
    Row: TableRow,
    Pagination: TablePagination,
})