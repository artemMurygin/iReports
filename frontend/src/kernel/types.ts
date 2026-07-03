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
