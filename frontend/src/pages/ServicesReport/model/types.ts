import type { DateRange } from 'react-day-picker'
import type { ServiceAnalyticsEntry } from '@/kernel/types'

export interface ServicesFilters {
    dateRange: DateRange
    selectedCategoryId: string | null
    serviceIds: string[]
    groupBy: 'day' | 'week' | 'month'
}

export interface ServiceCategory {
    id: number
    name: string
    parentId: number | null
    depth: number
}

export interface ServicesAnalyticsResponse {
    services: ServiceAnalyticsEntry[]
}
