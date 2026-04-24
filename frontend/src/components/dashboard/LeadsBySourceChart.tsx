import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { computeLeadsBySource } from "@/lib/computeStats"
import { type Deal } from "@/types/deal"

interface Props {
  deals: Deal[]
}

export function LeadsBySourceChart({ deals }: Props) {
  const data = useMemo(() => computeLeadsBySource(deals), [deals])
  const max = Math.max(...data.map((d) => d.percent), 1)

  return (
    <Card className="flex-1 shadow-sm flex flex-col min-h-0">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-base font-semibold text-gray-900">Источники лидов</CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Распределение по рекламным каналам
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-2 overflow-y-auto min-h-0">
        {data.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">Нет данных</p>
        )}
        {data.map((item) => (
          <div key={item.sourceId} className="flex items-center gap-3">
            <span
              className="text-sm text-gray-700 shrink-0"
              style={{ width: 110, fontFamily: "Inter, sans-serif" }}
            >
              {item.name}
            </span>
            <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden">
              <div
                className="h-full flex items-center justify-end px-2 rounded-md transition-all"
                style={{
                  width: `${(item.percent / max) * 100}%`,
                  backgroundColor: item.color,
                  minWidth: 'fit-content',
                }}
              >
                <span className="text-[11px] font-semibold text-white whitespace-nowrap" style={{ fontFamily: "Inter, sans-serif" }}>
                  {item.count} шт.
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}