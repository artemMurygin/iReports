import { RotateCcw } from 'lucide-react'

import { Button } from '@/shared/ui-kit/atoms/Button'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'
import { DateRangePicker } from '@/shared/ui/date-range-picker'
import { MultiSelect } from '@/shared/ui/MultiSelect'
import type { ServiceCategory, ServicesFilters } from '@/pages/ServicesReport/model/types.ts'

import { CategoryTreeSelect } from './CategoryTreeSelect'

type GroupBy = 'day' | 'week' | 'month'
const GROUP_BY_OPTIONS: SegmentedControlOption<GroupBy>[] = [
    { value: 'day', label: 'День' },
    { value: 'week', label: 'Неделя' },
    { value: 'month', label: 'Месяц' },
]

interface Props {
    filters: ServicesFilters
    categories: ServiceCategory[]
    services: { serviceId: number; serviceName: string }[]
    onChange: (filters: ServicesFilters) => void
    onReset: () => void
}

/**
 * Filter Row страницы `/services` (Pencil: фрейм `h7eHG` "Аналитика услуг · Redesign") — карточка
 * `rounded-xl border border-hairline bg-surface` в вертикальном потоке страницы (больше не
 * `sticky`, в отличие от прежней версии). Слева направо: `DateRangePicker` → `CategoryTreeSelect`
 * (чип с текущей категорией/сброс) → разделитель → услуги `MultiSelect` → распорка → период
 * `SegmentedControl` → разделитель → «Сбросить фильтры». `flex-wrap` переносит контролы на новую
 * строку на узких экранах вместо отдельной мобильной вёрстки — отдельный мобильный вариант этому
 * ряду не нужен (см. task). Оба разделителя скрыты ниже `sm` (`hidden sm:block`) — при переносе
 * на несколько строк фиксированной ширины `<div>`-разделитель "зависает" в конце обрезанной
 * строки без соседа справа (проверено вживую в Playwright на 390px), а не переносится вместе со
 * следующим контролом.
 *
 * `MultiSelect` рендерится всегда, даже когда у текущей категории нет ни одной услуги
 * (`services` пуст) — раньше он монтировался только при `services.length > 0`, из-за чего выбор
 * пустой категории резко схлопывал середину ряда и "телепортировал" период/сброс фильтров влево
 * (баг, найденный вживую в Playwright: "шапка плывёт" при выборе категории). `MultiSelect` с
 * пустым `options` сам корректно показывает "Ничего не найдено" при открытии, разваливать вёрстку
 * ради этого случая не нужно.
 */
export function ServicesFilterBar({ filters, categories, services, onChange, onReset }: Props) {
    const serviceOptions = services.map((s) => ({
        value: String(s.serviceId),
        label: s.serviceName,
    }))

    return (
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-hairline bg-surface p-2.5">
            <DateRangePicker value={filters.dateRange} onChange={(dateRange) => onChange({ ...filters, dateRange })} />

            <CategoryTreeSelect
                categories={categories}
                selectedId={filters.selectedCategoryId}
                onChange={(selectedCategoryId) => onChange({ ...filters, selectedCategoryId, serviceIds: [] })}
            />

            <div className="hidden h-[22px] w-px bg-hairline sm:block" />

            <MultiSelect
                options={serviceOptions}
                selected={filters.serviceIds}
                onChange={(serviceIds) => onChange({ ...filters, serviceIds })}
                placeholder="Все услуги"
                width="sm:w-[15%] lg:w-[30%]"
                searchable
            />

             <div className="flex-1" />

            <SegmentedControl
                aria-label="Группировка"
                options={GROUP_BY_OPTIONS}
                value={filters.groupBy}
                onValueChange={(groupBy) => onChange({ ...filters, groupBy })}
            />

            <div className="hidden h-[22px] w-px bg-hairline sm:block" />

            <Button variant="ghost" size="sm" onClick={onReset}>
                <RotateCcw />
            </Button>
        </div>
    )
}
