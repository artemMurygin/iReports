import { Search } from 'lucide-react'
import type { TargetOption } from '@/features/TargetDirectory'

import { Input } from '@/shared/ui-kit/atoms/Input'
import { SegmentedControl, type SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'

import type { SchemaDirectionFilter } from '../model/useSchemaFilters.ts'

const DIRECTION_OPTIONS: SegmentedControlOption<SchemaDirectionFilter>[] = [
    { value: 'all', label: 'Все' },
    { value: 'service', label: 'Сервис' },
    { value: 'shop', label: 'Магазин' },
]

const ALL_VALUE = 'all'

export type SchemaListFiltersProps = {
    direction: SchemaDirectionFilter
    onDirectionChange: (direction: SchemaDirectionFilter) => void
    schemaCountLabel: string
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
 * Pencil: design/sallary-first-iteration.pen, node `h4izP` (`Filter Bar`, desktop-only) — a
 * hand-built frame, not an instance of the library's generic `ERP/Organism/Filter Bar` (`X9nSM`),
 * so it's kept page-local rather than promoted to a shared organism. `Left`: Direction
 * `SegmentedControl` (Все/Сервис/Магазин) + a "N схем" counter — the counter reads the *filtered*
 * count (`schemaCountLabel`, i.e. after direction/search/target filters are applied), matching the
 * mobile list's "Показаны N из M схем" note, so it stays accurate as the user filters instead of
 * frozen at the mockup's static total. `Right`: search `Input` + two `Select`s reusing the shared
 * UI Kit atoms.
 */
function SchemaListFilters({
    direction,
    onDirectionChange,
    schemaCountLabel,
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
}: SchemaListFiltersProps) {
    return (
        <div data-slot="schema-list-filters" className={className}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <SegmentedControl
                        aria-label="Направление"
                        options={DIRECTION_OPTIONS}
                        value={direction}
                        onValueChange={onDirectionChange}
                    />
                    <span className="font-ui text-xs text-ink-muted">{schemaCountLabel}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative w-[260px]">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-[14px] -translate-y-1/2 text-ink-faint" />
                        <Input
                            value={search}
                            onChange={(event) => onSearchChange(event.target.value)}
                            placeholder="Поиск по названию"
                            className="pl-8"
                        />
                    </div>

                    <Select
                        value={departmentId !== null ? String(departmentId) : ALL_VALUE}
                        onValueChange={(value) => onDepartmentIdChange(value === ALL_VALUE ? null : Number(value))}
                        disabled={isDepartmentsLoading}
                    >
                        <SelectTrigger className="w-[180px]">
                            <span className="text-ink-muted">Отдел:&nbsp;</span>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_VALUE}>все</SelectItem>
                            {departments.map((department) => (
                                <SelectItem key={department.id} value={String(department.id)}>
                                    {department.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select
                        value={employeeId !== null ? String(employeeId) : ALL_VALUE}
                        onValueChange={(value) => onEmployeeIdChange(value === ALL_VALUE ? null : Number(value))}
                        disabled={isEmployeesLoading}
                    >
                        <SelectTrigger className="w-[200px]">
                            <span className="text-ink-muted">Сотрудник:&nbsp;</span>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_VALUE}>все</SelectItem>
                            {employees.map((employee) => (
                                <SelectItem key={employee.id} value={String(employee.id)}>
                                    {employee.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    )
}

export { SchemaListFilters }
