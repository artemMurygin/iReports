import { useMemo } from 'react'
import type { ServiceAnalyticsEntry } from '@/kernel/types'

export function useServicesStats(services: ServiceAnalyticsEntry[]) {
    return useMemo(() => {
        const sorted = [...services].sort((a, b) => b.totalCount - a.totalCount)
        const maxCount = sorted[0]?.totalCount ?? 1
        const totalCount = sorted.reduce((s, r) => s + r.totalCount, 0)
        const totalRevenue = sorted.reduce((s, r) => s + r.totalRevenue, 0)
        const totalProfit = sorted.reduce((s, r) => s + r.totalProfit, 0)
        const totalBonus = sorted.reduce((s, r) => s + r.totalEngineerBonus, 0)

        return {
            sorted,
            maxCount,
            totalCount,
            totalRevenue,
            totalProfit,
            totalBonus,
        }
    }, [services])
}
