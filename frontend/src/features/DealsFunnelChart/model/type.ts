export interface FunnelRowData {
    id: string
    label: string
    count: number
    revenue: number
    conversion: number | null
    isBranch: boolean
    color: string
}

export interface Acc {
    allCount: number
    allRevenue: number
    targetCount: number
    targetRevenue: number
    cameCount: number
    cameRevenue: number
    wonCount: number
    wonRevenue: number
    loseCount: number
    loseRevenue: number
    nonTargetCount: number
    nonTargetRevenue: number
}
