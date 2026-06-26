import { type DateRange } from "react-day-picker"

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