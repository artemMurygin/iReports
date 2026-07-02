export type Direction = 'SERVICE' | 'SHOP'
export type Scope = 'PERSONAL' | 'DEPARTMENT' | 'COMPANY'
export type GoalType = 'KPI' | 'TASK'
export type KpiDirection = 'SALES' | 'TURNOVER'
export type KpiStat = 'REVENUE' | 'MARGIN' | 'MARGIN_MINUS_ENGINEER' | 'PCS' | 'COSTS'
export type RewardType = 'PERCENT' | 'FIX'
export type ProgressionMode = 'FIXED' | 'LINEAR' | 'MULTIPLIER'
export type AccrualType = 'HOURLY' | 'BONUS' | 'PENALTY' | 'ADJUSTMENT' | 'FIXED' | 'ADVANCE'
export type RuleStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
export type ManagerRole = 'OFFLINE' | 'ONLINE' | 'BOTH'
export type ReportStatus = 'PROJECTED' | 'CLOSED'

export interface Employee {
    id: number
    firstName: string
    lastName: string
    departmentId: number
    roappOnlineName: string | null
}

export interface Department {
    id: number
    name: string
}

export interface CategoryNode {
    id: number | string
    name: string
    parentId: number | string | null
    depth?: number
    pathName?: string
}

export interface ProgressionTier {
    id?: number
    rewardId?: number
    fromPct: number
    toPct: number | null
    mode: ProgressionMode
    coef: number | null
    coefFrom: number | null
    coefTo: number | null
}

export interface Reward {
    id: number
    name: string
    type: RewardType
    value: number
    baseStat: KpiStat | null
    categoryExtId: string | null
    minAmount: number | null
    maxAmount: number | null
    tiers: ProgressionTier[]
}

export interface Goal {
    id: number
    ruleId: number
    type: GoalType
    direction: Direction
    scope: Scope
    name: string
    sortOrder: number
    kpiDirection: KpiDirection | null
    measureStat: KpiStat | null
    categoryExtId: string | null
    managerRole: ManagerRole
    rewardId: number
    reward: Reward
}

export interface RuleAssignment {
    id?: number
    employeeId?: number
    departmentId?: number
}

export interface SalaryRule {
    id: number
    name: string
    payPerHour: number | null
    isRegular: boolean
    validFrom: string
    validTo: string | null
    status: RuleStatus
    assignments: RuleAssignment[]
    goals: Goal[]
}

export interface WorkShift {
    id: number
    employeeId: number
    date: string
    plannedStart: string | null
    plannedEnd: string | null
    plannedHours: number
    actualHours: number | null
    status: string
    note: string | null
}

export interface PlanFactRow {
    id: number
    period: string
    direction: Direction
    scope: Scope
    employeeId: number | null
    departmentId: number | null
    categoryExtId: string | null
    stat: KpiStat
    planValue: number
    factValue: number
}

export interface SalaryLineItem {
    id: number
    reportId: number
    accrualType: AccrualType
    goalId: number | null
    rewardId: number | null
    sourceType: string | null
    sourceId: string | null
    label: string
    factAmount: number
    projected: number
    meta: Record<string, unknown> | null
}

export interface SalaryReportData {
    id: number
    employeeId: number
    period: string
    status: ReportStatus
    factTotal: number
    projected: number
    closedAt: string | null
    lineItems: SalaryLineItem[]
}

export interface SalaryAdjustment {
    id: number
    employeeId: number
    period: string
    accrualType: 'PENALTY' | 'ADJUSTMENT'
    amount: number
    reason: string
    createdById: number
    createdAt: string
}
