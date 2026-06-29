import type { DateRange } from 'react-day-picker'

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

export interface ServiceBreakdownPoint {
    period: string
    count: number
    avgPrice: number
    revenue: number
}

export interface ServiceAnalyticsEntry {
    serviceId: number
    serviceName: string
    categoryId: number | null
    totalCount: number
    totalRevenue: number
    totalProfit: number
    totalEngineerBonus: number
    avgServicePrice: number
    avgOrderCheck: number
    breakdown: ServiceBreakdownPoint[]
}

export interface ServicesAnalyticsResponse {
    services: ServiceAnalyticsEntry[]
}

export interface ChartSeriesEntry {
    id: string
    name: string
    breakdown: ServiceBreakdownPoint[]
}

export interface BreadcrumbItem {
    id: string | null
    name: string
}
