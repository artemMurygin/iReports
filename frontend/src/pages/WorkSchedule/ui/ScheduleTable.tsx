import { useMemo } from 'react'
import type { MonthlyWorkScheduleResponse } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'

import { cellLabel, cellStyle, formatHours, resolveCellVariant } from '../model/cellPresentation.ts'
import { buildDayAggregateMap, buildEmployeeCellMap, isVacationLow, vacationDaysRemaining } from '../model/scheduleAggregates.ts'
import { buildScheduleGridTemplate, type ScheduleDayMeta } from '../model/scheduleDays.ts'

export type ScheduleTableProps = {
    days: ScheduleDayMeta[]
    employees: MonthlyWorkScheduleResponse['employees']
    dayAggregates: MonthlyWorkScheduleResponse['days']
    totalHours: number
    className?: string
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `Cko6w` -> `Schedule Table`. Три ряда
 * (`Header Row`/по одному `Row {Имя}` на сотрудника/`Footer Row`) — CSS Grid с общим
 * `grid-template-columns` (`buildScheduleGridTemplate`, `model/scheduleDays.ts`) вместо ручной
 * последовательности `w-[32px]`-дивов на каждый день, как в самом дизайне: тот же визуальный
 * результат, но без 31 почти одинакового JSX-блока на строку.
 *
 * Колонка сотрудника — `sticky left-0`: при горизонтальном скролле (31 колонка дня + 196px на
 * колонку сотрудника не помещаются на большинстве экранов) имя остаётся на месте (план, "липкая
 * колонка сотрудника"). Подпись паттерна под именем (`5/2 · 8 ч` в дизайне) не отрисовывается —
 * источника данных для неё нет (PRD, "Не в скоупе").
 *
 * Поповер редактирования дня (клик по ячейке) — Фаза 7, здесь ячейки не интерактивны.
 */
function ScheduleTable({ days, employees, dayAggregates, totalHours, className }: ScheduleTableProps) {
    const gridTemplateColumns = useMemo(() => buildScheduleGridTemplate(days.length), [days.length])
    const dayAggregateMap = useMemo(() => buildDayAggregateMap(dayAggregates), [dayAggregates])

    return (
        <div data-slot="work-schedule-table" className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}>
            <div className="overflow-x-auto">
                <div style={{ minWidth: 'max-content' }}>
                    <ScheduleTableHeaderRow days={days} gridTemplateColumns={gridTemplateColumns} />

                    {employees.map((employee) => (
                        <ScheduleTableRow
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

function ScheduleTableHeaderRow({
    days,
    gridTemplateColumns,
}: {
    days: ScheduleDayMeta[]
    gridTemplateColumns: string
}) {
    return (
        <div
            data-slot="work-schedule-header-row"
            className="grid h-[46px] border-b border-hairline bg-surface"
            style={{ gridTemplateColumns }}
        >
            <div className="sticky left-0 z-10 flex items-center border-r border-hairline bg-surface px-3.5">
                <span className="font-ui text-xs font-medium text-ink-muted">Сотрудник</span>
            </div>

            {days.map((day) => (
                <div
                    key={day.date}
                    className={cn(
                        'flex flex-col items-center justify-center gap-px',
                        day.isToday
                            ? 'border-b-2 border-brand-strong bg-brand-soft'
                            : day.isWeekend
                              ? 'bg-canvas'
                              : undefined,
                    )}
                >
                    <span
                        className={cn(
                            'font-ui text-xs font-semibold',
                            day.isToday ? 'font-bold text-ok-ink' : day.isWeekend ? 'text-ink-muted' : 'text-ink',
                        )}
                    >
                        {day.day}
                    </span>
                    <span className={cn('font-ui text-[9px]', day.isToday ? 'text-ok-ink' : 'text-ink-faint')}>
                        {day.weekdayShort}
                    </span>
                </div>
            ))}

            <div className="flex items-center justify-center border-l border-hairline">
                <span className="font-ui text-xs font-medium text-ink-muted">Часы</span>
            </div>
            <div className="flex items-center justify-center">
                <span className="font-ui text-xs font-medium text-ink-muted">Отпуск</span>
            </div>
        </div>
    )
}

function ScheduleTableRow({
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
            data-slot="work-schedule-row"
            data-employee-id={employee.employeeId}
            className="grid h-[42px] border-b border-hairline bg-surface last:border-b-0"
            style={{ gridTemplateColumns }}
        >
            <div className="sticky left-0 z-10 flex items-center border-r border-hairline bg-surface px-3.5">
                <span className="truncate font-ui text-[13px] font-medium text-ink">{employee.name}</span>
            </div>

            {days.map((day) => {
                const cell = cellsByDate.get(day.date)
                const variant = cell ? resolveCellVariant(cell) : 'EMPTY'
                const style = cellStyle(variant)
                const label = cell ? cellLabel(cell, variant) : '—'

                return (
                    <div key={day.date} className={cn('flex items-center justify-center', style.bgClassName)}>
                        <span className={cn('font-ui', variant === 'WORKING' ? 'text-xs font-medium' : 'text-[11px]', style.textClassName)}>
                            {label}
                        </span>
                    </div>
                )
            })}

            <div className="flex items-center justify-center border-l border-hairline">
                <span className="font-ui text-[13px] font-medium text-ink">{formatHours(employee.totalHours)} ч</span>
            </div>
            <div className="flex items-center justify-center gap-1">
                <span className={cn('font-ui text-[13px] font-semibold', isVacationLow(remaining) ? 'text-warn-ink' : 'text-ink')}>
                    {remaining}
                </span>
                <span className="font-ui text-[11px] text-ink-faint">из {employee.vacationDaysLimit}</span>
            </div>
        </div>
    )
}

function ScheduleTableFooterRow({
    days,
    dayAggregateMap,
    totalHours,
    gridTemplateColumns,
}: {
    days: ScheduleDayMeta[]
    dayAggregateMap: Map<string, number>
    totalHours: number
    gridTemplateColumns: string
}) {
    return (
        <div data-slot="work-schedule-footer-row" className="grid h-[42px] bg-canvas" style={{ gridTemplateColumns }}>
            <div className="sticky left-0 z-10 flex items-center border-r border-hairline bg-canvas px-3.5">
                <span className="font-ui text-xs font-medium text-ink-muted">Человек в смене</span>
            </div>

            {days.map((day) => (
                <div key={day.date} className="flex items-center justify-center">
                    <span className={cn('font-ui text-xs font-semibold', day.isWeekend ? 'text-warn-ink' : 'text-ink-muted')}>
                        {dayAggregateMap.get(day.date) ?? 0}
                    </span>
                </div>
            ))}

            <div className="flex items-center justify-center border-l border-hairline">
                <span className="font-ui text-[13px] font-semibold text-ink">{formatHours(totalHours)} ч</span>
            </div>
            <div />
        </div>
    )
}

export { ScheduleTable }
