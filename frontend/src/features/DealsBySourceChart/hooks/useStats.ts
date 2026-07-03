import type { Deal } from '@/types/deal.ts'
import { useMemo } from 'react'
import { C_BRAND } from '@/shared/constants/chartColors.ts'

export interface LeadsBySourceItem {
    sourceId: string
    name: string
    count: number
    revenue: number
    wonCount: number
    color: string
}

export function useStats(deals: Deal[]) {
    const data = useMemo(() => computeLeadsBySource(deals), [deals])

    function computeLeadsBySource(deals: Deal[]): LeadsBySourceItem[] {
        const map = new Map<
            string,
            { name: string; count: number; revenue: number; wonCount: number }
        >()
        for (const deal of deals) {
            const id = deal.leadSource ? String(deal.leadSource.id) : 'unknown'
            const name = deal.leadSource?.name ?? 'Неизвестно'
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
            .map(([sourceId, v]) => ({
                sourceId,
                name: v.name,
                count: v.count,
                revenue: v.revenue,
                wonCount: v.wonCount,
                color: C_BRAND,
            }))
    }

    return { data }
}
