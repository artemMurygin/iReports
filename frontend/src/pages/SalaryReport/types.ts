export interface Direction {
    id: number
    name: string
}

export interface CoefficientPoint {
    id: number
    scaleId: number
    fulfillmentPct: string
    coefficient: string
}

export interface CoefficientScale {
    id: number
    name: string
    points: CoefficientPoint[]
}

export interface MotivationTarget {
    id: number
    directionId: number
    metric: 'revenue' | 'margin'
    moySkladFolderId: string | null
    roappServiceCategoryId: number | null
    roappProductCategoryId: number | null
    direction: Direction
    moySkladFolder: { id: string; name: string } | null
    roappServiceCategory: { id: number; name: string } | null
    roappProductCategory: { id: number; name: string } | null
}

export interface RuleItem {
    id: number
    ruleId: number
    targetId: number
    basePercent: string
    target: MotivationTarget
}

export interface MotivationRule {
    id: number
    name: string
    directionId: number
    scaleId: number
    payoutBase: 'revenue' | 'margin'
    effectiveFrom: string | null
    direction: Direction
    scale: CoefficientScale
    items: RuleItem[]
}

export interface Plan {
    id: number
    targetId: number
    period: string
    value: string
    target: MotivationTarget
}

export interface Fact {
    id: number
    targetId: number
    period: string
    value: string
    source: 'moy_sklad' | 'roapp' | 'manual'
    syncedAt: string | null
    target: MotivationTarget
}

export interface MotivationRow {
    ruleId: number
    ruleName: string
    directionName: string
    targetId: number
    targetName: string
    metric: 'revenue' | 'margin'
    period: string
    planValue: number | null
    factValue: number | null
    basePercent: number
    daysPassed: number
    daysInMonth: number
    fulfillment: number | null
    coefficient: number | null
    factPercent: number | null
    forecastValue: number | null
    forecastFulfillment: number | null
    forecastCoefficient: number | null
    forecastPercent: number | null
}
