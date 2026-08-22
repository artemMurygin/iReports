import type { Deal } from '@/kernel/types'
import { useMemo } from 'react'
import { C_BRAND } from '@/kernel/chartColors'

export interface LeadsBySourceItem {
    sourceId: string
    name: string
    count: number
    revenue: number
    wonCount: number
    color: string
}

// Чистая функция на уровне модуля (а не внутри хука): объявление внутри useStats
// пересоздавало её на каждый рендер и не давало React Compiler сохранить
// useMemo-мемоизацию (react-hooks: «Existing memoization could not be preserved»).
function computeLeadsBySource(deals: Deal[]): LeadsBySourceItem[] {
    const map = new Map<string, { name: string; count: number; revenue: number; wonCount: number }>()
    for (const deal of deals) {
        const id = deal.leadSource ? String(deal.leadSource.id) : 'unknown'
        const name = deal.leadSource?.name ?? 'Неизвестно'
        const prev = map.get(id) ?? {
            name,
            count: 0,
            revenue: 0,
            wonCount: 0,
        }
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

export function useStats(deals: Deal[]) {
    const data = useMemo(() => computeLeadsBySource(deals), [deals])

    return { data }
}
