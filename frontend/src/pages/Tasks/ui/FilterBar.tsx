import { Search } from 'lucide-react'
import type { TaskDirection, TaskStatus } from 'ireports-contracts'

import { Input } from '@/shared/ui-kit/atoms/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui-kit/atoms/Select'
import { TASK_STATUS_BADGE_VARIANT } from '@/shared/ui-kit/atoms/TaskStatusBadge.tsx'
import { cn } from '@/shared/lib/tw'

import type { TaskDirectionFilter, TaskStatusFilter } from '../model/useTasksPage.ts'

const ALL_VALUE = 'all'

const STATUS_OPTIONS: TaskStatus[] = [
    'NEW',
    'IN_PROGRESS',
    'DONE',
    'CLOSED_SUCCESSFULLY',
    'CLOSED_UNSUCCESSFULLY',
    'REWORK',
]

const DIRECTION_LABEL: Record<TaskDirection, string> = {
    service: 'Сервис',
    shop: 'Магазин',
}
const DIRECTION_OPTIONS: TaskDirection[] = ['service', 'shop']

/** Chip-shaped `Select` trigger — same geometry as `atoms/Chip.tsx` (7px radius, hairline border,
 * 10/5 padding), reusing `Select` instead of the plain `Chip` atom so the filter is a real
 * dropdown, not just a pill (Pencil `Bcwcn`/`jOPdG`, "Статус: Все"/"Направление: Все"). */
const CHIP_TRIGGER_CLASSNAME =
    'h-auto w-fit gap-1.5 rounded-[7px] border-hairline bg-surface px-2.5 py-[5px] text-xs font-medium'

export type FilterBarProps = {
    statusFilter: TaskStatusFilter
    onStatusFilterChange: (status: TaskStatusFilter) => void
    directionFilter: TaskDirectionFilter
    onDirectionFilterChange: (direction: TaskDirectionFilter) => void
    search: string
    onSearchChange: (search: string) => void
    className?: string
}

/**
 * Pencil: `iZrrX`'s `T0lmxv` (Filter Bar) — two filter chips (Статус/Направление) + a search box.
 * Page-local, not a shared `ui-kit` organism (same call as `SalaryRuleList/ui/SchemaListFilters`):
 * the mockup's `Filter Bar` frame here isn't an instance of a reusable component either.
 */
function FilterBar({
    statusFilter,
    onStatusFilterChange,
    directionFilter,
    onDirectionFilterChange,
    search,
    onSearchChange,
    className,
}: FilterBarProps) {
    return (
        <div
            data-slot="tasks-filter-bar"
            className={cn('flex flex-wrap items-center justify-between gap-3', className)}
        >
            <div className="flex flex-wrap items-center gap-2">
                <Select value={statusFilter} onValueChange={(value) => onStatusFilterChange(value as TaskStatusFilter)}>
                    <SelectTrigger aria-label="Статус" className={CHIP_TRIGGER_CLASSNAME}>
                        <span className="text-ink-muted">Статус:&nbsp;</span>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_VALUE}>Все</SelectItem>
                        {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
                                {TASK_STATUS_BADGE_VARIANT[status].label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={directionFilter}
                    onValueChange={(value) => onDirectionFilterChange(value as TaskDirectionFilter)}
                >
                    <SelectTrigger aria-label="Направление" className={CHIP_TRIGGER_CLASSNAME}>
                        <span className="text-ink-muted">Направление:&nbsp;</span>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_VALUE}>Все</SelectItem>
                        {DIRECTION_OPTIONS.map((direction) => (
                            <SelectItem key={direction} value={direction}>
                                {DIRECTION_LABEL[direction]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="relative w-full sm:w-[280px]">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-ink-faint" />
                <Input
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Поиск по названию задачи"
                    className="pl-9"
                    aria-label="Поиск по названию задачи"
                />
            </div>
        </div>
    )
}

export { FilterBar }
