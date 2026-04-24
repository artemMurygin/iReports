import { type DealsResponse } from "@/types/deal"

export async function fetchDeals(from: Date, to: Date): Promise<DealsResponse> {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  })
  const res = await fetch(`/api/deals?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}