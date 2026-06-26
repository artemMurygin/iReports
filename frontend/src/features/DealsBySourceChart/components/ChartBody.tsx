import type { ReactNode } from 'react';
import { CardContent } from '@/shared/ui/card.tsx';
import type { LeadsBySourceItem } from '../hooks/useStats.ts';


type Props = {
    data: LeadsBySourceItem[]
    renderRow: (item: LeadsBySourceItem) => ReactNode
}

export function ChartBody(props: Props){
    const {
        data,
        renderRow
    } = props

    return (
        <CardContent className="flex flex-col gap-3 pt-2 overflow-y-auto min-h-0">
            <div className="flex items-center gap-3 text-xs text-gray-400" style={{ fontFamily: "Inter, sans-serif" }}>
                <span className="shrink-0" style={{ width: 150 }}>Источник</span>
                <span className="flex-1">Кол-во</span>
                <div className="flex gap-3 shrink-0">
                    <span className="w-[90px] text-right">Выручка</span>
                    <span className="w-[40px] text-right">Конв.</span>
                </div>
            </div>
            {!data.length && (
                <p className="text-sm text-gray-400 py-4 text-center">Нет данных</p>
            )}
            {data.map((item) => renderRow(item))}
        </CardContent>
    )
}