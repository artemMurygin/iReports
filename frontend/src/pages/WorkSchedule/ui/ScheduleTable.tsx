import { useMemo } from 'react'
import type { MonthlyWorkScheduleResponse, WorkScheduleDayCell } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui-kit/atoms/Popover'

import { cellLabel, cellStyle, dutyRingClassName, formatHours, resolveCellVariant } from '../model/cellPresentation.ts'
import { formatDayEditorDateLabel } from '../model/format.ts'
import {
    buildDayAggregateMap,
    buildEmployeeCellMap,
    isVacationLow,
    vacationDaysRemaining,
} from '../model/scheduleAggregates.ts'
import { buildScheduleGridTemplate, type ScheduleDayMeta } from '../model/scheduleDays.ts'
import { useScrollIntoViewOnce } from '../model/useScrollIntoViewOnce.ts'
import { DayEditorPopover } from './DayEditorPopover'

export type ScheduleTableProps = {
    days: ScheduleDayMeta[]
    employees: MonthlyWorkScheduleResponse['employees']
    dayAggregates: MonthlyWorkScheduleResponse['days']
    totalHours: number
    /** Строка сотрудника, к которой прокрутить и которую подсветить — переход по `?employeeId=` с
     * мобильного экрана «Отдел сегодня» (см. `ScheduleBody`'s `highlightedEmployeeId`). */
    highlightedEmployeeId?: number | null
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
 * Поповер редактирования дня (клик по ячейке, Фаза 7 — `DayEditorPopover`) открывается с каждой
 * ячейки `ScheduleTableRow`; `year` для подсказки об остатке отпуска в поповере вычисляется здесь
 * один раз из первого дня месяца (все дни `days` принадлежат одному календарному году — это один
 * вызов `GET /v1/work-schedule?month=`), а не в каждой ячейке отдельно.
 */
function ScheduleTable({
    days,
    employees,
    dayAggregates,
    totalHours,
    highlightedEmployeeId = null,
    className,
}: ScheduleTableProps) {
    const gridTemplateColumns = useMemo(() => buildScheduleGridTemplate(days.length), [days.length])
    const dayAggregateMap = useMemo(() => buildDayAggregateMap(dayAggregates), [dayAggregates])
    const year = useMemo(() => Number(days[0]?.date.slice(0, 4)) || new Date().getFullYear(), [days])

    return (
        <div
            data-slot="work-schedule-table"
            className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}
        >
            <div className="overflow-x-auto">
                <div style={{ minWidth: 'max-content' }}>
                    <ScheduleTableHeaderRow days={days} gridTemplateColumns={gridTemplateColumns} />

                    {employees.map((employee) => (
                        <ScheduleTableRow
                            key={employee.employeeId}
                            employee={employee}
                            days={days}
                            year={year}
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

/** Экспортирован для переиспользования в `RolesTable.tsx` (Фаза 8, узел `vO4tI`) — шапка таблицы
 * (числа дней/дни недели/колонки «Часы»/«Отпуск») у вкладок «Календарь» и «Роли» идентична, см.
 * чтение design-vO4tI-roles.html: различается только тело строк. */
export function ScheduleTableHeaderRow({
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
    year,
    gridTemplateColumns,
    isHighlighted = false,
}: {
    employee: MonthlyWorkScheduleResponse['employees'][number]
    days: ScheduleDayMeta[]
    year: number
    gridTemplateColumns: string
    isHighlighted?: boolean
}) {
    const cellsByDate = useMemo(() => buildEmployeeCellMap(employee), [employee])
    const remaining = vacationDaysRemaining(employee)
    const rowRef = useScrollIntoViewOnce<HTMLDivElement>(isHighlighted)

    return (
        <div
            ref={rowRef}
            data-slot="work-schedule-row"
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
                // Ячейка без записи графика (`cellsByDate.get` -> undefined) получает тот же
                // "пустой" объект, что и остальной day-editor-стек (`WorkScheduleDayCell` со всеми
                // полями null) — так `DayEditorPopover`/`useDayEditor` не должны отдельно обрабатывать
                // `cell: undefined` вдобавок к `status: null`.
                const cell: WorkScheduleDayCell = cellsByDate.get(day.date) ?? {
                    date: day.date,
                    entryId: null,
                    status: null,
                    hours: null,
                    role: null,
                    isOnDuty: false,
                }
                const variant = resolveCellVariant(cell)
                const style = cellStyle(variant)
                const label = cellLabel(cell, variant)

                return (
                    <Popover key={day.date}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className={cn(
                                    'flex h-full w-full cursor-pointer items-center justify-center outline-none transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-inset',
                                    style.bgClassName,
                                    dutyRingClassName(cell),
                                )}
                                aria-label={`${employee.name}, ${day.day} число`}
                            >
                                <span
                                    className={cn(
                                        'font-ui',
                                        variant === 'WORKING' ? 'text-xs font-medium' : 'text-[11px]',
                                        style.textClassName,
                                    )}
                                >
                                    {label}
                                </span>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent>
                            <DayEditorPopover
                                employeeId={employee.employeeId}
                                employeeName={employee.name}
                                date={day.date}
                                dateLabel={formatDayEditorDateLabel(day.date)}
                                cell={cell}
                                vacationDaysUsed={employee.vacationDaysUsed}
                                vacationDaysLimit={employee.vacationDaysLimit}
                                year={year}
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

/** Экспортирован для переиспользования в `RolesTable.tsx` — см. комментарий у `ScheduleTableHeaderRow`;
 * подвал «Человек в смене» + общий фонд часов месяца тоже общий для обеих вкладок. */
export function ScheduleTableFooterRow({
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
                    <span
                        className={cn(
                            'font-ui text-xs font-semibold',
                            day.isWeekend ? 'text-warn-ink' : 'text-ink-muted',
                        )}
                    >
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
