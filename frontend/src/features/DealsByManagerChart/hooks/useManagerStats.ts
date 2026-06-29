import type { Deal } from '@/types/deal.ts'
import { useMemo } from 'react'
import { C_BRAND } from '@/shared/constants/chartColors.ts'

export interface ManagerStatItem {
    managerId: string
    name: string
    totalCount: number
    wonCount: number
    revenue: number
    conversion: number
    color: string
}

export function useManagerStats(deals: Deal[]) {
    const data = useMemo(() => {
        const map = new Map<string, { name: string; totalCount: number; wonCount: number; revenue: number }>()

        for (const deal of deals) {
            const id = deal.assignedBy ? String(deal.assignedBy.id) : 'unknown'
            const name = deal.assignedBy
                ? `${deal.assignedBy.firstName} ${deal.assignedBy.lastName}`
                : 'Без менеджера'
            const isWon = deal.stage?.id === 'WON'
            const prev = map.get(id) ?? { name, totalCount: 0, wonCount: 0, revenue: 0 }
            map.set(id, {
                name,
                totalCount: prev.totalCount + 1,
                wonCount: prev.wonCount + (isWon ? 1 : 0),
                revenue: prev.revenue + (isWon ? (deal.opportunity ?? 0) : 0),
            })
        }

        return Array.from(map.entries())
            .map(([managerId, v]) => ({
                managerId,
                name: v.name,
                totalCount: v.totalCount,
                wonCount: v.wonCount,
                revenue: v.revenue,
                conversion: v.totalCount > 0 ? Math.round((v.wonCount / v.totalCount) * 100) : 0,
                color: C_BRAND,
            }))
            .sort((a, b) => b.conversion - a.conversion)
    }, [deals])

    return { data }
}
