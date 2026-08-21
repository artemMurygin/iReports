import { useMemo } from 'react'
import type { MonthlyWorkScheduleResponse, WorkScheduleDayCell } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

import { formatHours } from '../model/cellPresentation.ts'
import { roleCellLabel, roleCellStyle } from '../model/rolePresentation.ts'
import { buildDayAggregateMap, buildEmployeeCellMap, isVacationLow, vacationDaysRemaining } from '../model/scheduleAggregates.ts'
import { buildScheduleGridTemplate, type ScheduleDayMeta } from '../model/scheduleDays.ts'
import { ScheduleTableFooterRow, ScheduleTableHeaderRow } from './ScheduleTable.tsx'

export type RolesTableProps = {
    days: ScheduleDayMeta[]
    employees: MonthlyWorkScheduleResponse['employees']
    dayAggregates: MonthlyWorkScheduleResponse['days']
    totalHours: number
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `vO4tI` -> `Schedule Table`. Тот же каркас, что
 * и `ScheduleTable` (Фаза 6, узел `Cko6w`) — шапка и подвал переиспользуются как есть
 * (`ScheduleTableHeaderRow`/`ScheduleTableFooterRow`, экспортированы из `ScheduleTable.tsx`, см.
 * их комментарии), различается только тело строки: вместо часов смены и поповера редактирования —
 * сокращение роли дня (`И`/`ОН`/`ОФ`/`ОС`/`—`) без интерактива. Эта фаза — read-only часть вкладки
 * «Роли» (план: "Редактирование роли … Фаза 8b, вне скоупа"), поэтому в отличие от
 * `ScheduleTableRow` ячейки здесь — обычные `div`, не `button`/`Popover`.
 */
function RolesTable({ days, employees, dayAggregates, totalHours, className }: RolesTableProps) {
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
}: {
    employee: MonthlyWorkScheduleResponse['employees'][number]
    days: ScheduleDayMeta[]
    gridTemplateColumns: string
}) {
    const cellsByDate = useMemo(() => buildEmployeeCellMap(employee), [employee])
    const remaining = vacationDaysRemaining(employee)

    return (
        <div
            data-slot="work-schedule-role-row"
            data-employee-id={employee.employeeId}
            className="grid h-[42px] border-b border-hairline bg-surface last:border-b-0"
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
                }
                const style = roleCellStyle(cell)
                const label = roleCellLabel(cell)

                return (
                    <div
                        key={day.date}
                        className={cn('flex h-full w-full items-center justify-center', style.bgClassName)}
                    >
                        <span className={cn('font-ui text-[11px] font-semibold', style.textClassName)}>{label}</span>
                    </div>
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
