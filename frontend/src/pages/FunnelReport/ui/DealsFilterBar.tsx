import { Button } from '@/shared/ui/button'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { DateRangePicker } from '@/shared/ui/date-range-picker'
import { SpinnerInlineSm } from '@/shared/ui/SpinnerInlineSm'
import { type DashboardFilters } from '@/pages/FunnelReport/types'
import { type ApiEmployee, type ApiEnumValue, type ApiStage } from '@/kernel/types'
import type { ReactNode } from 'react'

interface FilterBarProps {
    filters: DashboardFilters
    employees: ApiEmployee[]
    sources: ApiEnumValue[]
    stages: ApiStage[]
    stageGroups: { id: string; name: string }[]
    deviceTypes: Pick<ApiEnumValue, 'id' | 'name'>[]
    loading?: boolean
    onChange: (filters: DashboardFilters) => void
    onReset: () => void
}

export function DealsFilterBar({
    filters,
    employees,
    sources,
    deviceTypes,
    stages,
    stageGroups,
    loading,
    onChange,
    onReset,
}: FilterBarProps) {
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
        <DealsFilterBarLayOut>
            <DateRangePicker
                value={filters.dateRange}
                onChange={(dateRange) => onChange({ ...filters, dateRange })}
            />
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
                options={stageGroups.map((g) => ({ value: g.id, label: g.name }))}
                selected={filters.stageGroups}
                onChange={(stageGroups) => onChange({ ...filters, stageGroups })}
                placeholder="Все группы"
            />
            <div className="flex-1" />
            {loading && <SpinnerInlineSm label="Обновление..." />}
            <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="text-gray-500 hover:text-gray-700"
            >
                Сбросить фильтры
            </Button>
        </DealsFilterBarLayOut>
    )
}

function DealsFilterBarLayOut({ children }: { children: ReactNode }) {
    return (
        <div className="sticky top-16 z-10 flex items-center gap-4 px-6 py-3 bg-white border-b border-gray-200 shrink-0">
            {children}
        </div>
    )
}
