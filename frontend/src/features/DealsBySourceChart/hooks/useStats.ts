import type { Deal } from '@/types/deal.ts';
import { useMemo } from 'react';

export interface LeadsBySourceItem {
    sourceId: string
    name: string
    count: number
    revenue: number
    wonCount: number
    color: string
}

export function useStats(deals: Deal[]) {
    const SOURCE_COLORS = [
        "#D2C3A5",
        "#BFAE8E",
        "#7ED957",
        "#6EE7A2",
        "#4CD37A",
        "#38C172",
        "#AAB7BC",
        "#2DAA5F",
        "#8C7B5A",
        "#6F7F86",
        "#5A5A5A",
        "#3E4549",
        "#2F3437",
        "#1F2326",
        "#1A1E20"
    ];

    const data = useMemo(() => computeLeadsBySource(deals), [deals])

    function computeLeadsBySource(deals: Deal[]): LeadsBySourceItem[] {
        const map = new Map<string, { name: string; count: number; revenue: number; wonCount: number }>()
        for (const deal of deals) {
            const id = deal.leadSource ? String(deal.leadSource.id) : "unknown"
            const name = deal.leadSource?.name ?? "Неизвестно"
            const prev = map.get(id) ?? { name, count: 0, revenue: 0, wonCount: 0 }
            map.set(id, {
                name,
                count: prev.count + 1,
                revenue: prev.revenue + (deal.stage?.id === 'WON' ? (deal.opportunity ?? 0) : 0),
                wonCount: prev.wonCount + (deal.stage?.id === 'WON' ? 1 : 0),
            })
        }
        return Array.from(map.entries())
            .sort(([, a], [, b]) => b.count - a.count)
            .map(([sourceId, v], i) => ({
                sourceId,
                name: v.name,
                count: v.count,
                revenue: v.revenue,
                wonCount: v.wonCount,
                color: SOURCE_COLORS[i % SOURCE_COLORS.length],
            }))
    }

    return { data }
}
