import { Building2, Search, UserRound } from 'lucide-react'
import type { TargetOption } from '@/features/TargetDirectory'

import { Input } from '@/shared/ui-kit/atoms/Input'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'

import type { SchemaDirectionFilter } from '../model/useSchemaFilters.ts'

import { TargetFilterSheet } from './TargetFilterSheet.tsx'

const DIRECTION_OPTIONS: SegmentedControlOption<SchemaDirectionFilter>[] = [
    { value: 'all', label: 'Все' },
    { value: 'service', label: 'Сервис' },
    { value: 'shop', label: 'Магазин' },
]

export type SchemaListFiltersMobileProps = {
    direction: SchemaDirectionFilter
    onDirectionChange: (direction: SchemaDirectionFilter) => void
    search: string
    onSearchChange: (search: string) => void
    departments: TargetOption[]
    departmentId: number | null
    onDepartmentIdChange: (id: number | null) => void
    isDepartmentsLoading: boolean
    employees: TargetOption[]
    employeeId: number | null
    onEmployeeIdChange: (id: number | null) => void
    isEmployeesLoading: boolean
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, node `qJ0qx` — the `md:hidden` mobile filter stack:
 * full-width `Search`, the same Все/Сервис/Магазин `Direction Segmented` control below it, then the
 * `Filter Chips` row (`vSH2p`) opening `TargetFilterSheet`.
 */
function SchemaListFiltersMobile({
    direction,
    onDirectionChange,
    search,
    onSearchChange,
    departments,
    departmentId,
    onDepartmentIdChange,
    isDepartmentsLoading,
    employees,
    employeeId,
    onEmployeeIdChange,
    isEmployeesLoading,
    className,
}: SchemaListFiltersMobileProps) {
    return (
        <div data-slot="schema-list-filters-mobile" className={className}>
            <div className="flex flex-col gap-3">
                <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-ink-faint" />
                    <Input
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Поиск по названию"
                        className="h-10 pl-9"
                    />
                </div>

                <SegmentedControl
                    aria-label="Направление"
                    options={DIRECTION_OPTIONS}
                    value={direction}
                    onValueChange={onDirectionChange}
                />

                <div className="flex flex-wrap items-center gap-2">
                    <TargetFilterSheet
                        icon={<Building2 />}
                        label="Отдел"
                        options={departments}
                        value={departmentId}
                        onValueChange={onDepartmentIdChange}
                        isLoading={isDepartmentsLoading}
                    />
                    <TargetFilterSheet
                        icon={<UserRound />}
                        label="Сотрудник"
                        options={employees}
                        value={employeeId}
                        onValueChange={onEmployeeIdChange}
                        isLoading={isEmployeesLoading}
                    />
                </div>
            </div>
        </div>
    )
}

export { SchemaListFiltersMobile }
