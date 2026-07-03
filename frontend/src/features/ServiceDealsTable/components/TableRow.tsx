import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { type Deal } from '@/types/deal'
import { useServiceDealsTable } from '../context'
import { getInitials, formatDate, formatAmount } from '../utils'

interface TableRowProps {
    deal: Deal
    isEven: boolean
}

export function TableRow({ deal, isEven }: TableRowProps) {
    const { openDeal } = useServiceDealsTable()

    return (
        <div
            onClick={() => openDeal(deal.id)}
            className={[
                'flex items-center h-12 border-b border-gray-200 last:border-0 cursor-pointer hover:bg-blue-50 transition-colors',
                isEven ? 'bg-gray-50' : 'bg-white',
            ].join(' ')}
        >
            <div className="w-[130px] px-3 text-sm text-gray-500">{formatDate(deal.createdAt)}</div>
            <div className="flex-1 px-3 text-sm font-medium text-gray-900 truncate">
                {deal.title ?? '—'}
            </div>
            <div className="w-[180px] px-3 flex items-center gap-2">
                {deal.assignedBy && (
                    <>
                        <Avatar className="w-7 h-7 shrink-0">
                            <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[10px] font-semibold">
                                {getInitials(deal.assignedBy.firstName, deal.assignedBy.lastName)}
                            </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-gray-900 truncate">
                            {deal.assignedBy.firstName} {deal.assignedBy.lastName}
                        </span>
                    </>
                )}
            </div>
            <div className="w-[200px] px-3">
                <span className="text-xs text-gray-500">{deal.stage.name}</span>
            </div>
            <div className="w-[200px] px-3 text-sm text-gray-500 truncate">
                {deal.leadSource?.name ?? 'Не заполнено'}
            </div>
            <div className="w-[200px] px-3 text-sm text-gray-500 truncate">
                {deal.pointOfContact?.name ?? 'Не указан'}
            </div>
            <div className="w-[140px] px-3 text-sm font-semibold text-gray-900 text-right">
                {formatAmount(deal.opportunity)}
            </div>
        </div>
    )
}
