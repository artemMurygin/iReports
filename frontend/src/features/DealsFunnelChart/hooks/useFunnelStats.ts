import type { Deal } from '@/kernel/types'
import { useMemo } from 'react'
import { C_BRAND, C_POSITIVE, C_NEGATIVE, C_NEUTRAL } from '@/kernel/chartColors'

export interface FunnelRowData {
    id: string
    label: string
    count: number
    revenue: number
    conversion: number | null
    isBranch: boolean
    color: string
}

interface Acc {
    allCount: number
    allRevenue: number
    targetCount: number
    targetRevenue: number
    cameCount: number
    cameRevenue: number
    wonCount: number
    wonRevenue: number
    loseCount: number
    loseRevenue: number
    nonTargetCount: number
    nonTargetRevenue: number
}

export function useFunnelStats(deals: Deal[]) {
    const rows = useMemo(() => computeFunnel(deals), [deals])
    const maxCount = Math.max(...rows.map((r) => r.count), 1)
    const mainRows = rows.filter((r) => !r.isBranch)
    const branchRows = rows.filter((r) => r.isBranch)
    return { rows, maxCount, mainRows, branchRows }
}

function computeFunnel(deals: Deal[]): FunnelRowData[] {
    const acc = deals.reduce<Acc>(
        (a, deal) => {
            const groupId = deal.stage?.stageGroupId ?? null
            const opp = deal.opportunity ?? 0

            a.allCount++
            a.allRevenue += opp

            if (groupId === 'nonTarget') {
                a.nonTargetCount++
                a.nonTargetRevenue += opp
                return a
            }

            a.targetCount++
            a.targetRevenue += opp

            const isWon = groupId === 'won'
            const isCame = isWon || deal.stage?.id === '13'

            if (isCame) {
                a.cameCount++
                a.cameRevenue += opp
            }
            if (isWon) {
                a.wonCount++
                a.wonRevenue += opp
            }
            if (groupId === 'lose') {
                a.loseCount++
                a.loseRevenue += opp
            }

            return a
        },
        {
            allCount: 0,
            allRevenue: 0,
            targetCount: 0,
            targetRevenue: 0,
            cameCount: 0,
            cameRevenue: 0,
            wonCount: 0,
            wonRevenue: 0,
            loseCount: 0,
            loseRevenue: 0,
            nonTargetCount: 0,
            nonTargetRevenue: 0,
        },
    )

    const conv = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

    return [
        {
            id: 'all',
            label: 'Всего заявок',
            count: acc.allCount,
            revenue: acc.allRevenue,
            conversion: null,
            isBranch: false,
            color: C_NEUTRAL,
        },
        {
            id: 'target',
            label: 'Целевых заявок',
            count: acc.targetCount,
            revenue: acc.targetRevenue,
            conversion: conv(acc.targetCount, acc.allCount),
            isBranch: false,
            color: C_BRAND,
        },
        {
            id: 'came',
            label: 'Приехали на ремонт',
            count: acc.cameCount,
            revenue: acc.cameRevenue,
            conversion: conv(acc.cameCount, acc.targetCount),
            isBranch: false,
            color: C_BRAND,
        },
        {
            id: 'won',
            label: 'Оплатили заказ',
            count: acc.wonCount,
            revenue: acc.wonRevenue,
            conversion: conv(acc.wonCount, acc.cameCount),
            isBranch: false,
            color: C_POSITIVE,
        },
        {
            id: 'lose',
            label: 'Отказные сделки',
            count: acc.loseCount,
            revenue: acc.loseRevenue,
            conversion: null,
            isBranch: true,
            color: C_NEGATIVE,
        },
        {
            id: 'nonTarget',
            label: 'Нецелевые сделки',
            count: acc.nonTargetCount,
            revenue: acc.nonTargetRevenue,
            conversion: null,
            isBranch: true,
            color: C_NEUTRAL,
        },
    ]
}
