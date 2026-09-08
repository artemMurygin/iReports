import { Search } from 'lucide-react'
import type { ListDepartmentsResponse } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Input } from '@/shared/ui-kit/atoms/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'

import { ALL_DEPARTMENTS, type IdentityTab } from '../model/useIdentityFilters.ts'

const TABS: SegmentedControlOption<IdentityTab>[] = [
    { value: 'all', label: 'Все' },
    { value: 'partial', label: 'Только в одной' },
    { value: 'none', label: 'Без связей' },
]

export type FilterBarProps = {
    tab: IdentityTab
    onTabChange: (tab: IdentityTab) => void
    departments: ListDepartmentsResponse
    departmentId: string
    onDepartmentChange: (departmentId: string) => void
    search: string
    onSearchChange: (search: string) => void
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, фрейм `CpVvw`, панель фильтров: слева вкладки
 * охвата и селект отдела, справа поиск.
 *
 * Собрана из атомов UI Kit локально — готовой панели фильтров в `shared/ui-kit` нет, а из
 * трёх контролов в одном ряду выносить общий компонент нечего. Иконка поиска положена поверх
 * `Input` абсолютом (`Input` — намеренно голый `<input>` без слотов), отступ слева
 * компенсируется `pl-9`.
 */
function FilterBar({
    tab,
    onTabChange,
    departments,
    departmentId,
    onDepartmentChange,
    search,
    onSearchChange,
    className,
}: FilterBarProps) {
    return (
        <div
            data-slot="employee-identity-filter-bar"
            className={cn('flex flex-wrap items-center justify-between gap-2.5', className)}
        >
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
                <SegmentedControl
                    options={TABS}
                    value={tab}
                    onValueChange={onTabChange}
                    aria-label="Фильтр по охвату систем"
                    className="w-full sm:w-auto"
                />

                <Select value={departmentId} onValueChange={onDepartmentChange}>
                    <SelectTrigger className="w-full sm:w-[220px]" aria-label="Отдел">
                        <SelectValue placeholder="Все отделы" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_DEPARTMENTS}>Все отделы</SelectItem>
                        {departments.map((department) => (
                            <SelectItem key={department.id} value={String(department.id)}>
                                {department.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="relative w-full sm:w-[240px]">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-ink-faint" />
                <Input
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Поиск по фамилии"
                    aria-label="Поиск по фамилии"
                    className="pl-9"
                />
            </div>
        </div>
    )
}

export { FilterBar }
