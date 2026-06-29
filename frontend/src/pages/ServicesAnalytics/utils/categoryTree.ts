import type { ServiceCategory, ServiceAnalyticsEntry, ChartSeriesEntry, ServiceBreakdownPoint } from '../types'

export function resolveDescendantIds(categories: ServiceCategory[], selectedId: string): number[] {
    const rootId = Number(selectedId)
    const ids: number[] = [rootId]
    const queue: number[] = [rootId]
    while (queue.length > 0) {
        const current = queue.shift()!
        for (const cat of categories) {
            if (cat.parentId === current) {
                ids.push(cat.id)
                queue.push(cat.id)
            }
        }
    }
    return ids
}

export function getDirectChildren(categories: ServiceCategory[], parentId: string | null): ServiceCategory[] {
    const numId = parentId !== null ? Number(parentId) : null
    return categories.filter((c) => c.parentId === numId)
}

function mergePeriodBreakdowns(entries: ServiceAnalyticsEntry[]): ServiceBreakdownPoint[] {
    if (!entries.length) return []
    const periods = entries[0].breakdown.map((b) => b.period)
    return periods.map((period, i) => {
        const count = entries.reduce((s, e) => s + (e.breakdown[i]?.count ?? 0), 0)
        const weightedSum = entries.reduce(
            (s, e) => s + (e.breakdown[i]?.avgPrice ?? 0) * (e.breakdown[i]?.count ?? 0),
            0,
        )
        const avgPrice = count > 0 ? Math.round(weightedSum / count) : 0
        return { period, count, avgPrice, revenue: Math.round(weightedSum) }
    })
}

function enrichBreakdown(breakdown: ServiceBreakdownPoint[]): ServiceBreakdownPoint[] {
    return breakdown.map((b) => ({ ...b, revenue: Math.round(b.count * b.avgPrice) }))
}

export function buildChartSeries(
    services: ServiceAnalyticsEntry[] | undefined,
    categories: ServiceCategory[],
    selectedCategoryId: string | null,
): { series: ChartSeriesEntry[] } {
    if (!services?.length) return { series: [] }

    const directChildren = getDirectChildren(categories, selectedCategoryId)

    if (directChildren.length === 0) {
        const series: ChartSeriesEntry[] = services.map((s) => ({
            id: String(s.serviceId),
            name: s.serviceName,
            breakdown: enrichBreakdown(s.breakdown),
        }))
        return { series }
    }

    const childrenHaveSubcategories = directChildren.some((child) =>
        categories.some((c) => c.parentId === child.id),
    )

    if (childrenHaveSubcategories) {
        const series: ChartSeriesEntry[] = []
        for (const child of directChildren) {
            const childIds = resolveDescendantIds(categories, String(child.id))
            const childServices = services.filter(
                (s) => s.categoryId !== null && childIds.includes(s.categoryId),
            )
            if (!childServices.length) continue
            series.push({
                id: String(child.id),
                name: child.name,
                breakdown: mergePeriodBreakdowns(childServices),
            })
        }
        return { series }
    }

    const series: ChartSeriesEntry[] = []
    for (const child of directChildren) {
        const childServices = services.filter((s) => s.categoryId === child.id)
        if (!childServices.length) continue
        series.push({
            id: String(child.id),
            name: child.name,
            breakdown: mergePeriodBreakdowns(childServices),
        })
    }
    return { series }
}
