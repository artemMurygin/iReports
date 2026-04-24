import { format, getISOWeek, getISOWeekYear } from "date-fns"
import { ru } from "date-fns/locale"
import { type Deal, type ApiEmployee, type ApiEnumValue } from "@/types/deal"
import { type DashboardFilters } from "@/types/filters"

// ─── Фильтрация ───────────────────────────────────────────────────────────────

export function applyFilters(deals: Deal[], filters: DashboardFilters): Deal[] {
    return deals.filter((deal) => {
        if (
            filters.managers.length > 0 &&
            !filters.managers.includes(String(deal.assignedBy?.id ?? ""))
        ) return false
        if (
            filters.sources.length > 0 &&
            !filters.sources.includes(String(deal.leadSource?.id ?? EMPTY_SOURCE_ID))
        ) return false
        if (
            filters.deviceTypes.length > 0 &&
            !filters.deviceTypes.includes(deal.deviceType?.value ?? EMPTY_DEVICE_TYPE)
        ) return false
        if (
            filters.stages.length > 0 &&
            !filters.stages.includes(String(deal.stage?.id ?? ""))
        ) return false
        return true
    })
}

export const EMPTY_DEVICE_TYPE = "__empty__"
export const EMPTY_SOURCE_ID = -1
export const EMPTY_SOURCE: ApiEnumValue = { id: EMPTY_SOURCE_ID, value: "Не заполнено", fieldName: "" }

export function deriveDeviceTypes(deals: Deal[]): string[] {
    const set = new Set<string>()
    let hasEmpty = false
    for (const deal of deals) {
        if (deal.deviceType?.value) set.add(deal.deviceType.value)
        else hasEmpty = true
    }
    const result = Array.from(set).sort((a, b) => a.localeCompare(b))
    if (hasEmpty) result.push(EMPTY_DEVICE_TYPE)
    return result
}

// ─── Справочники из данных ─────────────────────────────────────────────────────

export function deriveEmployees(deals: Deal[]): ApiEmployee[] {
  const map = new Map<number, ApiEmployee>()
  for (const deal of deals) {
    if (deal.assignedBy) map.set(deal.assignedBy.id, deal.assignedBy)
  }
  return Array.from(map.values()).sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
  )
}

export function deriveSources(deals: Deal[]): ApiEnumValue[] {
  const map = new Map<number, ApiEnumValue>()
  let hasEmpty = false
  for (const deal of deals) {
    if (deal.leadSource) map.set(deal.leadSource.id, deal.leadSource)
    else hasEmpty = true
  }
  const result = Array.from(map.values()).sort((a, b) => a.id - b.id)
  if (hasEmpty) result.push(EMPTY_SOURCE)
  return result
}

export function deriveStages(deals: Deal[]): ApiEnumValue[] {
    const map = new Map<string, ApiEnumValue>()

    for (const deal of deals) {
        if (deal.stage) map.set(deal.stage.id, deal.stage)
    }
    return Array.from(map.values()).sort((a, b) => a.id - b.id)
}

// ─── KPI ───────────────────────────────────────────────────────────────────────

export interface KpiStats {
    allLeads: number
    nonTargetDeals: number
    targetedLeads: number
    won: number
    lose: number
    inWork: number
    waitingInService: number
    inService: number
    revenue: number
    conversionRate: number
    avgDeal: number
}

export function computeKpi(deals: Deal[]): KpiStats {
    const inWorkStages = [
        "UC_U52J7C",
        "UC_HML04K",
        "UC_E2KAHD",
        "NEW",
        "UC_ZR6PTH",
        "UC_X5VJM9",
        "UC_7FXM5Z",
        "UC_CDLDG7",
        "UC_2SD91N"
    ]
    const waitingInServiceStages = [
        "EXECUTING"
    ]
    const inServiceStages = [
        "UC_UPDA02",
        "UC_EWM3W9"
    ]
    const loseStages = [
        '4',
        '8',
        '7',
        '6',
        '5',
        '1',
        'LOSE',
        '2',
        '12',
        'UC_6NHK6F',
        '13'
    ]

    const revenue = deals.reduce((s, d) => {
      if (d.stage?.id === "WON") return s += (d.opportunity ?? 0)
      return s
    }, 0)
    const allLeads = deals.length
    const nonTargetDeals = deals.filter((d) => d.stage?.id === "3").length
    const targetedLeads = deals.filter((d) => d.stage?.id !== "3").length
    const won = deals.filter((d) => d.stage?.id === "WON").length
    const lose = deals.filter((d) => loseStages.includes(d.stage?.id)).length
    const inWork = deals.filter((d) => inWorkStages.includes(d.stage?.id)).length
    const waitingInService = deals.filter((d) => waitingInServiceStages.includes(d.stage?.id)).length
    const inService = deals.filter((d) => inServiceStages.includes(d.stage?.id)).length
    const conversionRate = targetedLeads > 0 ? Math.round((won / targetedLeads) * 1000) / 10 : 0
    const avgDeal = won > 0 ? Math.round(revenue / won) : 0

    return { allLeads, nonTargetDeals, targetedLeads, won, lose, inWork, waitingInService, inService, conversionRate, avgDeal, revenue }
}

// ─── Лиды по источнику ─────────────────────────────────────────────────────────

export interface LeadsBySourceItem {
  sourceId: string
  name: string
  count: number
  percent: number
  color: string
}

const SOURCE_COLORS = [
    "#D2C3A5",
    "#BFAE8E",
    "#7ED957",
    "#6EE7A2",
    "#4CD37A",
    "#38C172",
    "#AAB7BC",
    "#2DAA5F",
    "#8C7B5A",
    "#6F7F86",
    "#5A5A5A",
    "#3E4549",
    "#2F3437",
    "#1F2326",
    "#1A1E20"
];

export function computeLeadsBySource(deals: Deal[]): LeadsBySourceItem[] {
  const counts = new Map<string, { name: string; count: number }>()
  for (const deal of deals) {
    const id = deal.leadSource ? String(deal.leadSource.id) : "unknown"
    const name = deal.leadSource?.name ?? "Неизвестно"
    const prev = counts.get(id) ?? { name, count: 0 }
    counts.set(id, { name, count: prev.count + 1 })
  }
  const total = deals.length || 1
  return Array.from(counts.entries())
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([sourceId, { name, count }], i) => ({
      sourceId,
      name,
      count,
      percent: Math.round((count / total) * 100),
      color: SOURCE_COLORS[i % SOURCE_COLORS.length],
    }))
}

// ─── Лиды по времени ──────────────────────────────────────────────────────────

export type GroupBy = "day" | "week" | "month"

export interface TimeSeriesPoint {
  label: string
  [sourceId: string]: number | string
}

export interface SourceLine {
  id: string
  name: string
  color: string
}

function bucketLabel(date: Date, groupBy: GroupBy): string {
  if (groupBy === "day") return format(date, "d MMM", { locale: ru })
  if (groupBy === "week") return `Нед ${getISOWeek(date)}`
  return format(date, "LLL", { locale: ru })
}

function bucketKey(date: Date, groupBy: GroupBy): string {
  if (groupBy === "day") return format(date, "yyyy-MM-dd")
  if (groupBy === "week") return `${getISOWeekYear(date)}-W${String(getISOWeek(date)).padStart(2, "0")}`
  return format(date, "yyyy-MM")
}

export function computeLeadsOverTime(
  deals: Deal[],
  groupBy: GroupBy
): { data: TimeSeriesPoint[]; sources: SourceLine[] } {
  const buckets = new Map<string, { label: string; counts: Map<string, number> }>()
  const sourceMap = new Map<string, string>()

  for (const deal of deals) {
    const date = new Date(deal.createdAt)
    const key = bucketKey(date, groupBy)
    const label = bucketLabel(date, groupBy)
    const sourceId = deal.leadSource ? String(deal.leadSource.id) : "unknown"
    const sourceName = deal.leadSource?.value ?? "Неизвестно"
    sourceMap.set(sourceId, sourceName)

    if (!buckets.has(key)) buckets.set(key, { label, counts: new Map() })
    const bucket = buckets.get(key)!
    bucket.counts.set(sourceId, (bucket.counts.get(sourceId) ?? 0) + 1)
  }

  const sourceLines: SourceLine[] = Array.from(sourceMap.entries()).map(
    ([id, name], i) => ({ id, name, color: SOURCE_COLORS[i % SOURCE_COLORS.length] })
  )

  const data: TimeSeriesPoint[] = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, { label, counts }]) => {
      const point: TimeSeriesPoint = { label }
      for (const [sourceId, count] of counts) {
        point[sourceId] = count
      }
      return point
    })

  return { data, sources: sourceLines }
}

// ─── Воронка ──────────────────────────────────────────────────────────────────

export interface FunnelItem {
  stageId: string
  name: string
  count: number
  revenue: number
  percent: number
  color: string
  revenueColor: string
  isSuccess: boolean
  isFail: boolean
  shortLabel: string
}

function lightenColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const blend = (c: number) => Math.round(c + (255 - c) * 0.65)
  return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`
}

export function computeFunnel(deals: Deal[]): FunnelItem[] {
  const stageMap = new Map<
    string,
    { name: string; count: number; revenue: number; color: string; sort: number; systemType: string }
  >()

  for (const deal of deals) {
    const stage = deal.stage
    if (!stage) continue
    const prev = stageMap.get(stage.id) ?? {
      name: stage.name,
      count: 0,
      revenue: 0,
      color: stage.color || "#6b7280",
      sort: stage.sort,
      systemType: stage.systemType,
    }
    stageMap.set(stage.id, {
      ...prev,
      count: prev.count + 1,
      revenue: prev.revenue + (deal.opportunity ?? 0),
    })
  }

  const items = Array.from(stageMap.entries()).sort(
    ([, a], [, b]) => a.sort - b.sort
  )

  const maxCount = Math.max(...items.map(([, v]) => v.count), 1)

  return items.map(([stageId, v]) => ({
    stageId,
    name: v.name,
    shortLabel: v.name.length > 8 ? v.name.slice(0, 7) + "." : v.name,
    count: v.count,
    revenue: v.revenue,
    percent: Math.round((v.count / maxCount) * 100),
    color: v.color,
    revenueColor: lightenColor(v.color),
    isSuccess: v.systemType === "SUCCESS",
    isFail: v.systemType === "FAIL",
  }))
}