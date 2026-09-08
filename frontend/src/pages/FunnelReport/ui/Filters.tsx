import { Button } from '@/shared/ui/button'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { DateRangePicker } from '@/shared/ui/date-range-picker'
import { SpinnerInlineSm } from '@/shared/ui/SpinnerInlineSm'
import { type FilterBarProps, type OptionSource } from '@/pages/FunnelReport/model/types'
import type { ReactNode } from 'react'

function getOptions<T extends OptionSource>(this: T[]) {
    return this.map((item): { value: string; label: string } => {
        return {
            value: String(item.id),
            label: item?.name ?? `${item.firstName} ${item.lastName}`,
        }
    })
}

export function Filters({
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
    return (
        <Layout>
            <DateRangePicker value={filters.dateRange} onChange={(dateRange) => onChange({ ...filters, dateRange })} />
            <MultiSelect
                options={getOptions.call(employees)}
                selected={filters.managers}
                onChange={(managers) => onChange({ ...filters, managers })}
                placeholder="Все менеджеры"
            />
            <MultiSelect
                options={getOptions.call(sources)}
                selected={filters.sources}
                onChange={(sources) => onChange({ ...filters, sources })}
                placeholder="Все источники"
            />
            <MultiSelect
                options={getOptions.call(deviceTypes)}
                selected={filters.deviceTypes}
                onChange={(deviceTypes) => onChange({ ...filters, deviceTypes })}
                placeholder="Все модели"
            />
            <MultiSelect
                options={getOptions.call(stages)}
                selected={filters.stages}
                onChange={(stages) => onChange({ ...filters, stages })}
                placeholder="Все этапы"
            />
            <MultiSelect
                options={stageGroups.map((g) => ({
                    value: g.id,
                    label: g.name,
                }))}
                selected={filters.stageGroups}
                onChange={(stageGroups) => onChange({ ...filters, stageGroups })}
                placeholder="Все группы"
            />
            <div className="flex-1" />
            {loading && <SpinnerInlineSm label="Обновление..." />}
            <Button variant="ghost" size="sm" onClick={onReset} className="text-gray-500 hover:text-gray-700">
                Сбросить фильтры
            </Button>
        </Layout>
    )
}

function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="sticky top-16 z-10 flex items-center gap-4 px-6 py-3 bg-white border-b border-gray-200 shrink-0">
            {children}
        </div>
    )
}
