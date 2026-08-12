import { type DateRange } from 'react-day-picker'
import type { ApiEmployee, ApiEnumValue, ApiStage, ApiStageExtended, Deal } from '@/kernel/types'

// Справочник источников сделок (GET /v1/service/sales/deals/sources,
// см. pages/FunnelReport/model/api.ts) реально отдаёт форму
// contracts.DealLeadSource — { id: number; name: string } (модель
// BitrixLeadSources), а не ApiEnumValue ({id,value,fieldName,name?}),
// который использовался тут исторически, но так и не соответствовал
// фактическому ответу ни у legacy `/deals/sources`, ни у нового
// эндпоинта (см. contracts/commands/deal.ts, комментарий у
// dealLeadSourceSchema). Локальный тип вместо ApiEnumValue — чтобы не
// расходиться с реальными данными; kernel/types.ts не трогаем, т.к.
// ApiEnumValue используется и для действительно ApiEnumValue-подобных
// полей (например Deal.brand) в других частях фронтенда.
export interface ApiDealSource {
    id: number
    name: string
}

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
    sources: ApiDealSource[]
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
    sources: ApiDealSource[]
    deviceTypes: Pick<ApiEnumValue, 'id' | 'name'>[]
    stageGroups: { id: string; name: string }[]
}
