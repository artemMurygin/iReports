import type { LeadsBySourceItem } from '@/features/DealsBySourceChart/model/useStats.ts'

export function useSort(data: LeadsBySourceItem[]) {
    const sorted = [...data].sort((a, b) => b.count - a.count)
    const max = Math.max(...sorted.map((item) => item.count), 1)

    return {
        sorted,
        max,
    }
}
