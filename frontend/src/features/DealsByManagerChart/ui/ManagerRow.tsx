import type { ManagerStatItem } from '@/features/DealsByManagerChart/model/useManagerStats'

type Props = {
    item: ManagerStatItem
}

export function ManagerRow({ item }: Props) {
    const { name, totalCount, revenue, conversion, color } = item

    return (
        <div className="flex items-center gap-3">
            <span
                className="text-s text-gray-700 shrink-0 truncate"
                style={{ width: 130, fontFamily: 'Inter, sans-serif' }}
            >
                {name}
            </span>
            <div
                className="flex-1 h-7 flex rounded-md overflow-hidden"
                style={{ backgroundColor: 'var(--c-track)' }}
            >
                <div
                    className="h-full flex items-center justify-start px-2 rounded-md transition-all"
                    style={{
                        width: `${Math.max(conversion, 4)}%`,
                        backgroundColor: color,
                        minWidth: 'fit-content',
                    }}
                >
                    <span
                        className="text-[11px] font-semibold text-white whitespace-nowrap"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                        {conversion}%
                    </span>
                </div>
            </div>
            <div
                className="flex gap-3 shrink-0 text-xs text-gray-500 font-semibold"
                style={{ fontFamily: 'Inter, sans-serif' }}
            >
                <span className="w-[60px] text-right tabular-nums">{totalCount} шт.</span>
                <span className="w-[90px] text-right tabular-nums">
                    {revenue.toLocaleString('ru-RU')} ₽
                </span>
            </div>
        </div>
    )
}
