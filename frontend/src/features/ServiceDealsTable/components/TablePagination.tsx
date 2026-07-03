import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/shared/ui/button'

interface TablePaginationProps {
    page: number
    totalPages: number
    total: number
    rangeFrom: number
    rangeTo: number
    onPageChange: (updater: (prev: number) => number) => void
}

export function TablePagination({
    page,
    totalPages,
    total,
    rangeFrom,
    rangeTo,
    onPageChange,
}: TablePaginationProps) {
    return (
        <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm text-gray-500">
                Показано {rangeFrom}–{rangeTo} из {total}
            </span>
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 w-8 p-0"
                >
                    <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-700 font-medium">
                    {page} / {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-8 w-8 p-0"
                >
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}
