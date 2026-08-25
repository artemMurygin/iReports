import { TreePalm } from 'lucide-react'
import type { WorkScheduleDayCell } from 'ireports-contracts'

import { cn } from '@/shared/lib/tw'
import { Checkbox } from '@/shared/ui-kit/atoms/Checkbox'

import { vacationDaysRemaining } from '@/pages/WorkSchedule/model/scheduleAggregates.ts'

import { useDayEditor } from '../model/useDayEditor.ts'
import { HoursEditor } from './HoursEditor.tsx'
import { StatusOptions } from './StatusOptions.tsx'

export type DayEditorPopoverProps = {
    employeeId: number
    employeeName: string
    date: string
    dateLabel: string
    cell: WorkScheduleDayCell
    vacationDaysUsed: number
    vacationDaysLimit: number
    year: number
}

/**
 * Pencil: design/sallary-first-iteration.pen, узел `Cko6w` → `Day Editor` — содержимое поповера,
 * открываемого кликом по ячейке таблицы (`ScheduleTable.tsx`). Чистая сборка слотов дизайна
 * (`Head`/`Status Options`/`Hours Row`+`Hours Slider`/`Divider`/`Hint`) вокруг `useDayEditor` —
 * весь стейт и сохранение живут в хуке, этот компонент только раскладывает его результат по вёрстке
 * (frontend/CLAUDE.md, «Mediator-компонент … не должен содержать условного рендера» — здесь его и
 * нет, `disabled` у `HoursEditor`/`Checkbox` уже булев проп, а не ветвление на JSX).
 *
 * Переключатель «Дежурный» — не часть дизайна `Cko6w` (там его нет), добавлен вслед за полем
 * `isOnDuty` (см. `docs/work-schedule-duty-mark`): та же строка `flex items-center justify-between`,
 * что уже использует `HoursEditor`'s заголовок, и то же правило disabled/`opacity-50`, что у
 * `HoursEditor` целиком — дежурство осмысленно только у рабочего дня.
 *
 * `Who` (design: «Артём Мурыгин · 5/2 · 8 ч») — только имя сотрудника: подпись паттерна смены не
 * реализуется (PRD, «Не в скоупе» — источника данных для неё нет).
 */
function DayEditorPopover({
    employeeId,
    employeeName,
    date,
    dateLabel,
    cell,
    vacationDaysUsed,
    vacationDaysLimit,
    year,
}: DayEditorPopoverProps) {
    const { status, hours, isOnDuty, selectStatus, previewHours, commitHours, stepHours, setOnDuty } = useDayEditor({
        employeeId,
        date,
        cell,
    })

    const remaining = vacationDaysRemaining({ vacationDaysUsed, vacationDaysLimit })
    const isWorking = status === 'WORKING'

    return (
        <div data-slot="day-editor" className="flex w-full flex-col gap-3">
            <div data-slot="day-editor-head" className="flex w-full flex-col gap-0.5">
                <span className="font-ui text-[13px] font-semibold text-ink">{dateLabel}</span>
                <span className="font-ui text-[11px] font-normal text-ink-faint">{employeeName}</span>
            </div>

            <StatusOptions status={status} onSelect={selectStatus} />

            <HoursEditor
                hours={hours}
                onPreview={previewHours}
                onCommit={commitHours}
                onStep={stepHours}
                disabled={!isWorking}
            />

            <div
                data-slot="day-editor-duty"
                className={cn('flex w-full items-center justify-between', !isWorking && 'opacity-50')}
            >
                <span className="font-ui text-xs font-normal text-ink-muted">Дежурный</span>
                <Checkbox checked={isOnDuty} onCheckedChange={setOnDuty} disabled={!isWorking} aria-label="Дежурный" />
            </div>

            <div data-slot="day-editor-divider" className="h-px w-full bg-hairline" />

            <div data-slot="day-editor-vacation-hint" className="flex w-full items-center gap-[7px]">
                <TreePalm className="size-[13px] shrink-0 text-warn-ink" />
                <span className="font-ui text-[11px] font-normal text-ink-muted">
                    Отпуск: осталось {remaining} из {vacationDaysLimit} дня в {year}
                </span>
            </div>
        </div>
    )
}

export { DayEditorPopover }
