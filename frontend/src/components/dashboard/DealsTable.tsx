import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { stageBadgeConfig } from "@/data/mockData"
import { type Deal } from "@/types/deal"

declare const BX24: { openPath: (path: string, callback?: (result: { result: string }) => void) => void }

const PAGE_SIZE = 10

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0]}${lastName[0]}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function formatAmount(amount: number | null) {
  if (amount === null) return "—"
  return `${amount.toLocaleString("ru-RU")} ₽`
}

interface Props {
  deals: Deal[]
}

export function DealsTable({ deals }: Props) {
  const [page, setPage] = useState(1)

  useEffect(() => { setPage(1) }, [deals])

  const totalPages = Math.max(1, Math.ceil(deals.length / PAGE_SIZE))
  const paginated = deals.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base font-semibold text-gray-900">Все сделки</CardTitle>
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            {deals.length} сделок
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border border-gray-200 rounded-lg overflow-hidden mx-5">
          {/* Header */}
          <div className="flex items-center h-11 bg-gray-50 border-b border-gray-200">
              <div className="w-[130px] px-3 text-xs font-medium text-gray-500">Создано</div>
            <div className="flex items-center gap-1 flex-1 px-3 text-xs font-medium text-gray-500">
              Название сделки <ChevronsUpDown className="w-3.5 h-3.5" />
            </div>

            <div className="w-[180px] px-3 text-xs font-medium text-gray-500">Менеджер</div>
              <div className="w-[200px] px-3 text-xs font-medium text-gray-500">Этап</div>
            <div className="w-[200px] px-3 text-xs font-medium text-gray-500">Источник</div>
              <div className="w-[200px] px-3 text-xs font-medium text-gray-500">Точка контакта</div>

            <div className="w-[140px] px-3 text-xs font-medium text-gray-500 text-right">Сумма</div>

          </div>

          {/* Rows */}
          {paginated.length === 0 && (
            <div className="flex items-center justify-center h-16 text-sm text-gray-400">
              Нет данных
            </div>
          )}
          {paginated.map((deal, idx) => {
            const badge = deal.stage ? stageBadgeConfig[deal.stage.id] : null
            const isEven = idx % 2 === 1

            return (
              <div
                key={deal.id}
                onClick={() => BX24.openPath(`/crm/deal/details/${deal.id}/`)}
                className={[
                  "flex items-center h-12 border-b border-gray-200 last:border-0 cursor-pointer hover:bg-blue-50 transition-colors",
                  isEven ? "bg-gray-50" : "bg-white",
                ].join(" ")}
              >
                  <div className="w-[130px] px-3 text-sm text-gray-500" style={{ fontFamily: "Inter, sans-serif" }}>
                      {formatDate(deal.createdAt)}
                  </div>
                <div className="flex-1 px-3 text-sm font-medium text-gray-900 truncate" style={{ fontFamily: "Inter, sans-serif" }}>
                  {deal.title ?? "—"}
                </div>

                <div className="w-[180px] px-3 flex items-center gap-2">
                  {deal.assignedBy && (
                    <>
                      <Avatar className="w-7 h-7 shrink-0">
                        <AvatarFallback className="bg-indigo-100 text-indigo-700 text-[10px] font-semibold">
                          {getInitials(deal.assignedBy.firstName, deal.assignedBy.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-gray-900 truncate" style={{ fontFamily: "Inter, sans-serif" }}>
                        {deal.assignedBy.firstName} {deal.assignedBy.lastName}
                      </span>
                    </>
                  )}
                </div>
                  <div className="w-[200px] px-3">
                    <span className="text-xs text-gray-500">{deal.stage.name}</span>
                  </div>
                <div className="w-[200px] px-3 text-sm text-gray-500 truncate" style={{ fontFamily: "Inter, sans-serif" }}>
                  {deal.leadSource?.name ?? "Не заполнено"}
                </div>
                  <div className="w-[200px] px-3 text-sm text-gray-500 truncate" style={{ fontFamily: "Inter, sans-serif" }}>
                      {deal.pointOfContact?.name ?? "Не указан"}
                  </div>


                  <div className="w-[140px] px-3 text-sm font-semibold text-gray-900 text-right" style={{ fontFamily: "Inter, sans-serif" }}>
                      {formatAmount(deal.opportunity)}
                  </div>
              </div>
            )
          })}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-gray-500" style={{ fontFamily: "Inter, sans-serif" }}>
            Показано {Math.min((page - 1) * PAGE_SIZE + 1, deals.length)}–{Math.min(page * PAGE_SIZE, deals.length)} из {deals.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-gray-700 font-medium" style={{ fontFamily: "Inter, sans-serif" }}>
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
