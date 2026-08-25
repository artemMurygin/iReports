import { useMemo } from 'react'
import type { MonthlyWorkScheduleResponse, WorkScheduleDayCell } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui-kit/atoms/Popover'

import { formatHours } from '../model/cellPresentation.ts'
import { formatDayEditorDateLabel } from '../model/format.ts'
import { isRoleEditableCell, roleCellLabel, roleCellStyle } from '../model/rolePresentation.ts'
import { buildDayAggregateMap, buildEmployeeCellMap, isVacationLow, vacationDaysRemaining } from '../model/scheduleAggregates.ts'
import { buildScheduleGridTemplate, type ScheduleDayMeta } from '../model/scheduleDays.ts'
import { useScrollIntoViewOnce } from '../model/useScrollIntoViewOnce.ts'
import { RolePickerPopover } from './RolePickerPopover'
import { ScheduleTableFooterRow, ScheduleTableHeaderRow } from './ScheduleTable.tsx'

export type RolesTableProps = {
    days: ScheduleDayMeta[]
    employees: MonthlyWorkScheduleResponse['employees']
    dayAggregates: MonthlyWorkScheduleResponse['days']
    totalHours: number
    /** Тот же смысл, что и у `ScheduleTable`'s `highlightedEmployeeId` — вкладка «Роли» рендерит
     * свою собственную строку на сотрудника (`RolesTableRow`), ей нужна своя подсветка. */
    highlightedEmployeeId?: number | null
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `vO4tI` -> `Schedule Table`. Тот же каркас, что
 * и `ScheduleTable` (Фаза 6, узел `Cko6w`) — шапка и подвал переиспользуются как есть
 * (`ScheduleTableHeaderRow`/`ScheduleTableFooterRow`, экспортированы из `ScheduleTable.tsx`, см.
 * их комментарии), различается только тело строки: вместо часов смены — сокращение роли дня
 * (`И`/`ОН`/`ОФ`/`ОС`/`—`).
 *
 * Ячейка рабочего дня (Фаза 8b, план: «Назначение роли рабочему дню из ячейки») — `button`/`Popover`
 * с `RolePickerPopover` внутри, тем же паттерном, что и `ScheduleTableRow`'s `DayEditorPopover`
 * (Фаза 7); ячейка нерабочего/незаполненного дня остаётся обычным `div` без интерактива — план,
 * «Клик по нерабочему дню (без роли) — роль не редактируется». `isRoleEditableCell`
 * (`model/rolePresentation.ts`) — единственное место, решающее, какая это ячейка.
 */
function RolesTable({
    days,
    employees,
    dayAggregates,
    totalHours,
    highlightedEmployeeId = null,
    className,
}: RolesTableProps) {
    const gridTemplateColumns = useMemo(() => buildScheduleGridTemplate(days.length), [days.length])
    const dayAggregateMap = useMemo(() => buildDayAggregateMap(dayAggregates), [dayAggregates])

    return (
        <div
            data-slot="work-schedule-roles-table"
            className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}
        >
            <div className="overflow-x-auto">
                <div style={{ minWidth: 'max-content' }}>
                    <ScheduleTableHeaderRow days={days} gridTemplateColumns={gridTemplateColumns} />

                    {employees.map((employee) => (
                        <RolesTableRow
                            key={employee.employeeId}
                            employee={employee}
                            days={days}
                            gridTemplateColumns={gridTemplateColumns}
                            isHighlighted={employee.employeeId === highlightedEmployeeId}
                        />
                    ))}

                    <ScheduleTableFooterRow
                        days={days}
                        dayAggregateMap={dayAggregateMap}
                        totalHours={totalHours}
                        gridTemplateColumns={gridTemplateColumns}
                    />
                </div>
            </div>
        </div>
    )
}

function RolesTableRow({
    employee,
    days,
    gridTemplateColumns,
    isHighlighted = false,
}: {
    employee: MonthlyWorkScheduleResponse['employees'][number]
    days: ScheduleDayMeta[]
    gridTemplateColumns: string
    isHighlighted?: boolean
}) {
    const cellsByDate = useMemo(() => buildEmployeeCellMap(employee), [employee])
    const remaining = vacationDaysRemaining(employee)
    const rowRef = useScrollIntoViewOnce<HTMLDivElement>(isHighlighted)

    return (
        <div
            ref={rowRef}
            data-slot="work-schedule-role-row"
            data-employee-id={employee.employeeId}
            className={cn(
                'grid h-[42px] border-b border-hairline bg-surface last:border-b-0',
                isHighlighted && 'ring-2 ring-inset ring-brand-strong',
            )}
            style={{ gridTemplateColumns }}
        >
            <div className="sticky left-0 z-10 flex items-center border-r border-hairline bg-surface px-3.5">
                <span className="truncate font-ui text-[13px] font-medium text-ink">{employee.name}</span>
            </div>

            {days.map((day) => {
                // Тот же приём, что и в `ScheduleTableRow`: день без записи графика получает
                // "пустой" объект со всеми полями null, а не остаётся `undefined`.
                const cell: WorkScheduleDayCell = cellsByDate.get(day.date) ?? {
                    date: day.date,
                    entryId: null,
                    status: null,
                    hours: null,
                    role: null,
                    isOnDuty: false,
                }
                const style = roleCellStyle(cell)
                const label = roleCellLabel(cell)

                // Нерабочий/незаполненный день — прочерк без интерактива (план: «роль не
                // редактируется»), тот же `div`, что и до Фазы 8b.
                if (!isRoleEditableCell(cell)) {
                    return (
                        <div
                            key={day.date}
                            className={cn('flex h-full w-full items-center justify-center', style.bgClassName)}
                        >
                            <span className={cn('font-ui text-[11px] font-semibold', style.textClassName)}>
                                {label}
                            </span>
                        </div>
                    )
                }

                return (
                    <Popover key={day.date}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className={cn(
                                    'flex h-full w-full cursor-pointer items-center justify-center outline-none transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-inset',
                                    style.bgClassName,
                                )}
                                aria-label={`${employee.name}, ${day.day} число, роль`}
                            >
                                <span className={cn('font-ui text-[11px] font-semibold', style.textClassName)}>
                                    {label}
                                </span>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent>
                            <RolePickerPopover
                                employeeId={employee.employeeId}
                                employeeName={employee.name}
                                date={day.date}
                                dateLabel={formatDayEditorDateLabel(day.date)}
                                cell={cell}
                            />
                        </PopoverContent>
                    </Popover>
                )
            })}

            <div className="flex items-center justify-center border-l border-hairline">
                <span className="font-ui text-[13px] font-medium text-ink">{formatHours(employee.totalHours)} ч</span>
            </div>
            <div className="flex items-center justify-center gap-1">
                <span
                    className={cn(
                        'font-ui text-[13px] font-semibold',
                        isVacationLow(remaining) ? 'text-warn-ink' : 'text-ink',
                    )}
                >
                    {remaining}
                </span>
                <span className="font-ui text-[11px] text-ink-faint">из {employee.vacationDaysLimit}</span>
            </div>
        </div>
    )
}

export { RolesTable }
