import type { ServiceAnalyticsEntry, ServiceBreakdownPoint, PeriodBreakdownEntry, ChartSeriesEntry } from '@/kernel/types'
import { getDirectChildren as getDirectChildrenById, getSubtreeIds } from '@/shared/lib/tree.ts'
import type { ServiceCategory } from './types'

export function resolveDescendantIds(categories: ServiceCategory[], selectedId: string): number[] {
    return getSubtreeIds(categories, Number(selectedId))
}

export function getDirectChildren(categories: ServiceCategory[], parentId: string | null): ServiceCategory[] {
    return getDirectChildrenById(categories, parentId !== null ? Number(parentId) : null)
}

export type CategorySearchMatch = { category: ServiceCategory; ancestors: ServiceCategory[] }

function getAncestorChain(categories: ServiceCategory[], parentId: number | null): ServiceCategory[] {
    const chain: ServiceCategory[] = []
    let current = parentId !== null ? categories.find((c) => c.id === parentId) : undefined
    while (current) {
        chain.unshift(current)
        current = current.parentId !== null ? categories.find((c) => c.id === current!.parentId) : undefined
    }
    return chain
}

/** Плоский список категорий, чьё название содержит `query` (без учёта регистра), каждая — с
 * цепочкой предков (от корня) для хлебной крошки в результатах поиска, аналогично
 * `catalogTree.ts` в `features/SalaryRuleForm` (тот же UX выбора категории, перенесённый на
 * страницу услуг). Пустой запрос возвращает пустой список — вызывающий код в этом случае
 * показывает обычное дерево, а не «ничего не найдено». */
export function searchCategories(categories: ServiceCategory[], query: string): CategorySearchMatch[] {
    const normalized = query.trim().toLowerCase()
    if (normalized === '') return []
    return categories
        .filter((c) => c.name.toLowerCase().includes(normalized))
        .map((c) => ({ category: c, ancestors: getAncestorChain(categories, c.parentId) }))
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

function enrichBreakdown(breakdown: PeriodBreakdownEntry[]): ServiceBreakdownPoint[] {
    return breakdown.map((b) => ({
        ...b,
        revenue: Math.round(b.count * b.avgPrice),
    }))
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

    const childrenHaveSubcategories = directChildren.some(
        (child) => getDirectChildrenById(categories, child.id).length > 0,
    )

    if (childrenHaveSubcategories) {
        const series: ChartSeriesEntry[] = []
        for (const child of directChildren) {
            const childIds = resolveDescendantIds(categories, String(child.id))
            const childServices = services.filter((s) => s.categoryId !== null && childIds.includes(s.categoryId))
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
