export interface ApiEmployee {
    id: number
    firstName: string
    lastName: string
}

export interface ApiStage {
    id: string
    name: string
    sort: number
    color: string
    systemType: string
    stageGroupId?: string
    stageGroupName?: string
}

export type ApiStageExtended = ApiStage

export interface ApiSource {
    id: string
    name: string
    sort: number
}

export interface ApiPointOfContact {
    id: string
    name: string
    sort: number
}

export interface ApiEnumValue {
    id: number
    value: string
    fieldName: string
    name?: string
}

export interface Deal {
    id: number
    title: string | null
    opportunity: number | null
    categoryId: number
    deviceModel: string | null
    deviceMalfunction: string | null
    createdAt: string
    updatedAt: string | null
    pointOfContact: ApiPointOfContact | null
    stage: ApiStage
    assignedBy: ApiEmployee | null
    source: ApiSource | null
    leadSource: ApiEnumValue | null
    brand: ApiEnumValue | null
    deviceType: ApiEnumValue | null
}

export interface DealsResponse {
    total: number
    deals: Deal[]
}

// Одна точка разбивки по периодам, как её реально отдаёт
// `GET /v1/service/reports/services` (periodBreakdownEntrySchema,
// contracts/commands/report.ts) — только period/count/avgPrice, без
// revenue: он на бэкенде не считается и не хранится, а восстанавливается
// на фронтенде (см. `enrichBreakdown`/`mergePeriodBreakdowns` в
// pages/ServicesReport/model/categoryTree.ts) как count * avgPrice.
export interface PeriodBreakdownEntry {
    period: string
    count: number
    avgPrice: number
}

// Точка разбивки после клиентского обогащения (см. categoryTree.ts) —
// используется только для ChartSeriesEntry.breakdown ниже, а не для
// "сырого" ответа API (см. PeriodBreakdownEntry выше).
export interface ServiceBreakdownPoint extends PeriodBreakdownEntry {
    revenue: number
}

export interface ServiceAnalyticsEntry {
    serviceId: number
    serviceName: string
    categoryId: number | null
    // Розничная (каталожная) цена услуги из карточки услуги в RemOnline
    // (RoappService.price) — справочная цена, не связана с фактической ценой
    // продажи (avgServicePrice ниже считается по факту проданных строк).
    retailPrice: number
    totalCount: number
    totalRevenue: number
    totalProfit: number
    totalEngineerBonus: number
    avgServicePrice: number
    avgOrderCheck: number
    breakdown: PeriodBreakdownEntry[]
}

export interface ChartSeriesEntry {
    id: string
    name: string
    breakdown: ServiceBreakdownPoint[]
}
