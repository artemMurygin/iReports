import type { LeadsBySourceItem } from '@/features/DealsBySourceChart/hooks/useStats.ts';

type Props = {
    item: LeadsBySourceItem
    max: number
}

export function ChartRow({ item, max }: Props) {
    const { sourceId, name, color, count, revenue, wonCount } = item
    const conversion = count > 0 ? Math.round((wonCount / count) * 100) : 0

    return (
        <div key={sourceId} className="flex items-center gap-3">
            <span
                className="text-s text-gray-700 shrink-0"
                style={{ width: 150, fontFamily: "Inter, sans-serif" }}
            >
                {name}
            </span>
            <div className="flex-1 h-7 flex rounded-md overflow-hidden" style={{ backgroundColor: 'var(--c-track)' }}>
                <div
                    className="h-full flex items-center justify-start px-2 rounded-md transition-all"
                    style={{
                        width: `${(count / max) * 100}%`,
                        backgroundColor: color,
                        minWidth: 'fit-content',
                    }}
                >
                    <span className="text-[11px] font-semibold text-white whitespace-nowrap" style={{ fontFamily: "Inter, sans-serif" }}>
                        {count} шт.
                    </span>
                </div>
            </div>
            <div className="flex gap-3 shrink-0 text-xs text-gray-500 font-semibold" style={{ fontFamily: "Inter, sans-serif" }}>
                <span className="w-[90px] text-right">{revenue.toLocaleString('ru-RU')} Р.</span>
                <span className="w-[40px] text-right">{conversion}%</span>
            </div>
        </div>
    )
}
