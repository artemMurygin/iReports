import type { LeadsEntry } from '@/features/DealsOverTimeCharts/model/types'
import { TREND_DOWN, TREND_NEUTRAL, TREND_UP } from '@/features/DealsOverTimeCharts/model/config'

interface UseMiniCardParams {
    source: string
    data: LeadsEntry[]
}

export function useMiniCard({ source, data }: UseMiniCardParams) {
    const pts = data.map((e) => ({ date: e.date, v: (e[source] as number) ?? 0 }))
    const lastVal = pts.at(-1)?.v ?? 0
    const firstVal = pts.at(0)?.v ?? 0
    const pct = firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : null
    const lineColor =
        pct === null ? TREND_NEUTRAL : pct > 0 ? TREND_UP : pct < 0 ? TREND_DOWN : TREND_NEUTRAL

    return { pts, lastVal, pct, lineColor }
}
