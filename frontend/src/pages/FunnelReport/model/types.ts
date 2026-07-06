import { type DateRange } from 'react-day-picker'
import type { ApiEmployee, ApiEnumValue, ApiStage, ApiStageExtended, Deal } from '@/kernel/types'

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

export type FilterBarProps = {
    filters: DashboardFilters
    employees: ApiEmployee[]
    sources: ApiEnumValue[]
    stages: ApiStage[]
    stageGroups: { id: string; name: string }[]
    deviceTypes: Pick<ApiEnumValue, 'id' | 'name'>[]
    loading?: boolean
    onChange: (filters: DashboardFilters) => void
    onReset: () => void
}

export type OptionSource = {
    id: string | number
    name?: string | null
    firstName?: string
    lastName?: string
}

export interface FilterOptionsResponse {
    stages: ApiStageExtended[]
    employees: ApiEmployee[]
    sources: ApiEnumValue[]
    deviceTypes: Pick<ApiEnumValue, 'id' | 'name'>[]
    stageGroups: { id: string; name: string }[]
}
