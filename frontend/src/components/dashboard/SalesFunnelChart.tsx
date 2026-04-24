import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { type FunnelItem } from "@/lib/computeStats"

const MAX_HEIGHT = 180

interface Props {
  data: FunnelItem[]
}

export function SalesFunnelChart({ data }: Props) {
  return (
    <Card className="flex-1 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-gray-900">Воронка продаж</CardTitle>
        <CardDescription className="text-sm text-gray-500">
          Количество сделок и выручка по этапам воронки
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[220px] text-sm text-gray-400">
            Нет данных
          </div>
        ) : (
          <>
            <div className="flex items-end gap-2 w-full" style={{ height: MAX_HEIGHT + 40 }}>
              {data.map((item) => {
                const barH = Math.round((item.percent / 100) * MAX_HEIGHT)
                const revenueH = Math.round(barH * 0.88)
                const labelColor = item.isSuccess ? "#16a34a" : item.isFail ? "#dc2626" : "#6b7280"
                const shadow = item.isSuccess
                  ? "0 0 8px 2px #16a34a40"
                  : item.isFail
                  ? "0 0 8px 2px #dc262640"
                  : undefined

                return (
                  <div
                    key={item.stageId}
                    className="flex flex-col items-center gap-1 flex-1"
                    style={{ alignSelf: "flex-end" }}
                  >
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: labelColor, fontFamily: "Inter, sans-serif" }}
                    >
                      {item.percent}%
                    </span>
                    <div className="flex gap-1 items-end w-full justify-center">
                      <div
                        className="rounded-md flex-1"
                        style={{ height: barH, backgroundColor: item.color, boxShadow: shadow }}
                      />
                      <div
                        className="rounded-md flex-1"
                        style={{ height: revenueH, backgroundColor: item.revenueColor, boxShadow: shadow }}
                      />
                    </div>
                    <span
                      className="text-[11px] font-medium text-center leading-tight"
                      style={{ color: labelColor, fontFamily: "Inter, sans-serif" }}
                    >
                      {item.shortLabel}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-center gap-5 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-gray-800" />
                <span className="text-xs text-gray-500" style={{ fontFamily: "Inter, sans-serif" }}>Сделки</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-gray-400" />
                <span className="text-xs text-gray-500" style={{ fontFamily: "Inter, sans-serif" }}>Выручка</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}