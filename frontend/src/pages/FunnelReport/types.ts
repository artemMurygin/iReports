import { type DateRange } from 'react-day-picker'
import type { Deal } from '@/kernel/types'

export interface DashboardKPI {
    allLeads: number
    nonTargetDeals: number
    targetedLeads: number
    won: number
    lose: number
    inWork: number
    waitingInService: number
    inService: number
    conversionRate: number
    avgDeal: number
    revenue: number
}

export interface DashboardFilters {
    dateRange: DateRange
    managers: string[]
    sources: string[]
    deviceTypes: string[]
    stages: string[]
    stageGroups: string[]
}

export interface ServiceFunnelResponse {
    KPI: DashboardKPI
    deals: Deal[]
}
