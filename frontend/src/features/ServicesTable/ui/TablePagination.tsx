import { ChevronLeft, ChevronRight } from 'lucide-react'
import { IconButton } from '@/shared/ui-kit/atoms/IconButton'

type Props = {
    shown: number
    total: number
    page: number
    pageCount: number
    onPageChange: (page: number) => void
}

/** Footer десктоп-таблицы (Pencil: `h7eHG` → `tmW21` "Table Section") — "Показано N из M услуг"
 * слева, Prev/Next + "{page} / {pageCount}" справа. */
export function TablePagination({ shown, total, page, pageCount, onPageChange }: Props) {
    return (
        <div className="flex items-center justify-between bg-canvas px-6 py-4">
            <p className="text-[12.5px] text-ink-muted">
                Показано {shown} из {total} услуг
            </p>
            <div className="flex items-center gap-2">
                <IconButton
                    aria-label="Предыдущая страница"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                >
                    <ChevronLeft />
                </IconButton>
                <span className="min-w-[52px] text-center font-ui text-[12.5px] font-medium text-ink tabular-nums">
                    {page} / {pageCount}
                </span>
                <IconButton
                    aria-label="Следующая страница"
                    disabled={page >= pageCount}
                    onClick={() => onPageChange(page + 1)}
                >
                    <ChevronRight />
                </IconButton>
            </div>
        </div>
    )
}
