import type { WorkScheduleShiftEmployee, WorkScheduleShiftRoleCount } from 'ireports-contracts'

import { EmptyState } from './EmptyState.tsx'
import { OnShiftSection } from './OnShiftSection.tsx'
import { RolesLegend } from './RolesLegend.tsx'
import { WeekStrip, type WeekStripDay } from './WeekStrip.tsx'

export type WorkScheduleTodayBodyProps = {
    weekDays: WeekStripDay[]
    onSelectDate: (date: string) => void
    onShift: WorkScheduleShiftEmployee[]
    roleCounts: WorkScheduleShiftRoleCount[]
    onShiftCount: number
    totalEmployees: number
    totalHours: number
}

/**
 * `WorkScheduleTodayPage`'s `Layout` `body` слот — единственный компонент, которому разрешён
 * условный рендер (frontend/CLAUDE.md, "Mediator-компонент для страниц с несколькими виджетами":
 * медиатор сам не должен ветвиться). Пустое состояние показывается только когда в выбранный день
 * в компании вообще нет сотрудников (`totalEmployees === 0`) — не путать с «на смену никто не
 * вышел» (это уже обрабатывает сам `OnShiftSection`, там ещё видна лента недели/легенда).
 */
export function WorkScheduleTodayBody({
    weekDays,
    onSelectDate,
    onShift,
    roleCounts,
    onShiftCount,
    totalEmployees,
    totalHours,
}: WorkScheduleTodayBodyProps) {
    if (totalEmployees === 0) {
        return (
            <>
                <WeekStrip days={weekDays} onSelect={onSelectDate} />
                <EmptyState />
            </>
        )
    }

    return (
        <>
            <WeekStrip days={weekDays} onSelect={onSelectDate} />
            <RolesLegend roleCounts={roleCounts} />
            <OnShiftSection
                employees={onShift}
                onShiftCount={onShiftCount}
                totalEmployees={totalEmployees}
                totalHours={totalHours}
            />
        </>
    )
}
