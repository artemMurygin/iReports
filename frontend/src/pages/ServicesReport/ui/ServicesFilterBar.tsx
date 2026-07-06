import { Button } from '@/shared/ui/button'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import { CategoryTreeSelect } from './CategoryTreeSelect'
import { DateRangePicker } from '@/shared/ui/date-range-picker'
import type { ServiceCategory, ServicesFilters } from '@/pages/ServicesReport/model/types.ts'

type GroupBy = 'day' | 'week' | 'month'
const GROUP_BY_LABELS: Record<GroupBy, string> = { day: 'День', week: 'Неделя', month: 'Месяц' }

interface Props {
    filters: ServicesFilters
    categories: ServiceCategory[]
    services: { serviceId: number; serviceName: string }[]
    onChange: (filters: ServicesFilters) => void
    onReset: () => void
}

export function ServicesFilterBar({
 filters, categories, services, onChange, onReset
}: Props) {
    const serviceOptions = services.map((s) => ({
        value: String(s.serviceId),
        label: s.serviceName,
    }))

    return (
        <div className="sticky top-16 z-10 flex items-center gap-4 px-6 py-3 bg-white border-b border-gray-200 shrink-0">
            <DateRangePicker
                value={filters.dateRange}
                onChange={(dateRange) => onChange({ ...filters, dateRange })}
            />

            <CategoryTreeSelect
                categories={categories}
                selectedId={filters.selectedCategoryId}
                onChange={(selectedCategoryId) =>
                    onChange({ ...filters, selectedCategoryId, serviceIds: [] })
                }
            />

            {services.length > 0 && (
                <MultiSelect
                    options={serviceOptions}
                    selected={filters.serviceIds}
                    onChange={(serviceIds) => onChange({ ...filters, serviceIds })}
                    placeholder="Все услуги"
                    width="w-[590px]"
                    searchable
                />
            )}

            <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs shrink-0">
                {(['day', 'week', 'month'] as GroupBy[]).map((g) => (
                    <button
                        key={g}
                        onClick={() => onChange({ ...filters, groupBy: g })}
                        className={`px-3 py-1.5 transition-colors ${filters.groupBy === g ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                    >
                        {GROUP_BY_LABELS[g]}
                    </button>
                ))}
            </div>

            <div className="flex-1" />

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
