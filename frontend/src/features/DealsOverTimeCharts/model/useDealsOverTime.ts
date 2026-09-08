import { useMemo, useState } from 'react'
import type { Deal } from '@/kernel/types'
import { buildTimeline, rankSourcesByTotal } from './utils'
import { TOP_N } from './config'
import type { Tab } from './types'

export function useDealsOverTime(deals: Deal[]) {
    const [activeTab, setActiveTab] = useState<Tab>('grid')

    const ranked = useMemo(() => rankSourcesByTotal(deals), [deals])
    const dayData = useMemo(() => buildTimeline(deals, 'day'), [deals])
    const weekData = useMemo(() => buildTimeline(deals, 'week'), [deals])

    const globalMaxDay = useMemo(() => {
        let m = 0
        dayData.forEach((entry) => {
            ranked.forEach((src) => {
                const v = (entry[src] as number) ?? 0
                if (v > m) m = v
            })
        })
        return m
    }, [dayData, ranked])

    const topSources = ranked.slice(0, TOP_N)
    const tailSources = ranked.slice(TOP_N)

    return {
        activeTab,
        setActiveTab,
        ranked,
        dayData,
        weekData,
        weekDataLen: weekData.length,
        globalMaxDay,
        topSources,
        tailSources,
    }
}
