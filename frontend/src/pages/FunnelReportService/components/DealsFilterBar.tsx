import { useState } from "react"
import { Calendar as CalendarIcon } from "lucide-react"
import { ru } from "date-fns/locale"
import { format } from "date-fns"
import { type DateRange } from "react-day-picker"
import { Button } from "@/shared/ui/button"
import { Calendar } from "@/shared/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover"
import { MultiSelect } from "./MultiSelect"
import { type DashboardFilters } from "@/pages/FunnelReportService/types"
import { type ApiEmployee, type ApiEnumValue, type ApiStage } from '@/types/deal'

function formatDateRange(range: DateRange | undefined): string {
  if (!range?.from) return "Выберите период"
  const from = format(range.from, "d MMM yyyy", { locale: ru })
  if (!range.to) return from
  const to = format(range.to, "d MMM yyyy", { locale: ru })
  return `${from} — ${to}`
}



interface FilterBarProps {
    filters: DashboardFilters
    employees: ApiEmployee[]
    sources: ApiEnumValue[]
    stages: ApiStage[]
    stageGroups: { id: string; name: string }[]
    deviceTypes: Pick<ApiEnumValue, "id" | "name">[]
    loading?: boolean
    onChange: (filters: DashboardFilters) => void
    onReset: () => void
}

export function DealsFilterBar({ filters, employees, sources, deviceTypes, stages, stageGroups, loading, onChange, onReset }: FilterBarProps) {
    const [calendarOpen, setCalendarOpen] = useState(false)

    const employeeOptions = employees.map((emp) => ({
        value: String(emp.id),
        label: `${emp.firstName} ${emp.lastName}`,
    }))

    const sourceOptions = sources.map((src) => ({
        value: String(src.id),
        label: src.name ?? '',
    }))

    const deviceTypeOptions = deviceTypes.map((type) => ({
        value: String(type.id),
        label: type.name ?? '',
    }))

    const stagesOptions = stages.map((stage) => ({
        value: String(stage.id),
        label: stage.name ?? '',
    }))


    return (
        <div className="sticky top-16 z-10 flex items-center gap-4 px-6 py-3 bg-white border-b border-gray-200 shrink-0">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 h-9 px-3 rounded-md border border-gray-200 w-[240px] cursor-pointer hover:border-gray-300 transition-colors text-sm text-gray-700">
                <CalendarIcon className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="truncate">{formatDateRange(filters.dateRange)}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={filters.dateRange}
                onSelect={(range) => {
                  const from = range?.from ? new Date(range.from.setHours(0, 0, 0, 0)) : undefined
                  const to = range?.to ? new Date(range.to.setHours(23, 59, 59, 999)) : undefined
                  onChange({ ...filters, dateRange: { from, to } })
                  if (range?.from && range?.to) setCalendarOpen(false)
                }}
                defaultMonth={filters.dateRange?.from}
                numberOfMonths={1}
                locale={ru}
              />
            </PopoverContent>
            </Popover>
            <MultiSelect
                options={employeeOptions}
                selected={filters.managers}
                onChange={(managers) => onChange({ ...filters, managers })}
                placeholder="Все менеджеры"
            />
            <MultiSelect
                options={sourceOptions}
                selected={filters.sources}
                onChange={(sources) => onChange({ ...filters, sources })}
                placeholder="Все источники"
            />
            <MultiSelect
                options={deviceTypeOptions}
                selected={filters.deviceTypes}
                onChange={(deviceTypes) => onChange({ ...filters, deviceTypes })}
                placeholder="Все модели"
            />
            <MultiSelect
                options={stagesOptions}
                selected={filters.stages}
                onChange={(stages) => onChange({ ...filters, stages })}
                placeholder="Все этапы"
            />
            <MultiSelect
                options={stageGroups.map(g => ({ value: g.id, label: g.name }))}
                selected={filters.stageGroups}
                onChange={(stageGroups) => onChange({ ...filters, stageGroups })}
                placeholder="Все группы"
            />
            <div className="flex-1" />
            {loading && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Обновление...
                </div>
            )}
            <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="text-gray-500 hover:text-gray-700"
            >
                Сбросить фильтры
            </Button>
        </div>
    )
}
