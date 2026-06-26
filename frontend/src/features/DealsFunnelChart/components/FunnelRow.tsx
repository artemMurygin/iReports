import type { FunnelRowData } from '../hooks/useFunnelStats.ts';

type Props = {
    item: FunnelRowData
    max: number
}

export function FunnelRow({ item, max }: Props) {
    const { label, count, revenue, color, conversion } = item

    return (
        <div className="flex items-center gap-3">
            <span
                className="text-s text-gray-700 shrink-0"
                style={{ width: 160, fontFamily: 'Inter, sans-serif' }}
            >
                {label}
            </span>
            <div className="flex-1 h-7 flex justify-center bg-gray-100 rounded-md overflow-hidden">
                <div
                    className="h-full flex items-center justify-center px-2 rounded-md transition-all"
                    style={{
                        width: `${(count / max) * 100}%`,
                        backgroundColor: color,
                        minWidth: count > 0 ? 'fit-content' : '0',
                    }}
                >
                    {count > 0 && (
                        <span className="text-[11px] font-semibold text-white whitespace-nowrap" style={{ fontFamily: 'Inter, sans-serif' }}>
                            {count} шт.
                        </span>
                    )}
                </div>
            </div>
            <div className="flex gap-3 shrink-0 text-xs text-gray-500 font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>
                <span className="w-[100px] text-right">{revenue.toLocaleString('ru-RU')} Р.</span>
                <span className="w-[50px] text-right text-gray-400">
                    {conversion !== null ? `↓ ${conversion}%` : '—'}
                </span>
            </div>
        </div>
    )
}
