import { type Deal } from "@/types/deal"

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