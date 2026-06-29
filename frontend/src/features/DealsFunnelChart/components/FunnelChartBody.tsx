import type { ReactNode } from 'react';
import { CardContent } from '@/shared/ui/card.tsx';
import type { FunnelRowData } from '../hooks/useFunnelStats.ts';

type Props = {
    mainRows: FunnelRowData[]
    branchRows: FunnelRowData[]
    renderRow: (item: FunnelRowData) => ReactNode
}

export function FunnelChartBody({ mainRows, branchRows, renderRow }: Props) {
    const hasData = [...mainRows, ...branchRows].some((r) => r.count > 0)

    return (
        <CardContent className="flex-1 flex flex-col gap-3 pt-2 overflow-y-auto min-h-0">
            <div className="flex items-center gap-3 text-xs text-gray-400" style={{ fontFamily: 'Inter, sans-serif' }}>
                <span className="shrink-0" style={{ width: 160 }}>Этап</span>
                <span className="flex-1">Кол-во</span>
                <div className="flex gap-3 shrink-0">
                    <span className="w-[100px] text-right">Сумма</span>
                    <span className="w-[50px] text-right">Конв.</span>
                </div>
            </div>

            {!hasData && (
                <p className="text-sm text-gray-400 py-4 text-center">Нет данных</p>
            )}

            {mainRows.map((row) => renderRow(row))}

            {branchRows.length > 0 && (
                <div className="border-t border-gray-100 pt-3 flex flex-col gap-3">
                    {branchRows.map((row) => renderRow(row))}
                </div>
            )}
        </CardContent>
    )
}
