import type { Deal } from '@/kernel/types.ts'
import type { LeadsEntry } from '@/features/DealsOverTimeCharts/model/types.ts'

export function getDateKey(dateStr: string, period: 'day' | 'week'): string {
    const date = new Date(dateStr)
    if (period === 'day') return dateStr.slice(5, 10).split('-').reverse().join('.')
    const day = date.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(date)
    monday.setDate(date.getDate() + diffToMonday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = (d: Date) =>
        `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
    return `${fmt(monday)}-${fmt(sunday)}`
}

export function buildTimeline(deals: Deal[], period: 'day' | 'week'): LeadsEntry[] {
    return deals
        .reduce((result: LeadsEntry[], deal) => {
            const date = getDateKey(deal.createdAt, period)
            const source = deal.leadSource?.name ?? 'Не заполнено'
            let entry = result.find((e) => e.date === date)
            if (!entry) {
                entry = { date, _originalDate: deal.createdAt }
                result.push(entry)
            }
            entry[source] = ((entry[source] as number) ?? 0) + 1
            return result
        }, [])
        .sort((a, b) => new Date(a._originalDate).getTime() - new Date(b._originalDate).getTime())
}

export function rankSourcesByTotal(deals: Deal[]): string[] {
    const map = new Map<string, number>()
    deals.forEach((deal) => {
        const s = deal.leadSource?.name ?? 'Не заполнено'
        map.set(s, (map.get(s) ?? 0) + 1)
    })
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
}
