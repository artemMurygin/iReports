import type { WorkScheduleAbsenceGroup, WorkScheduleShiftEmployee, WorkScheduleShiftRoleCount } from 'ireports-contracts'

import { EmptyState } from './EmptyState.tsx'
import { FooterNote } from './FooterNote.tsx'
import { NotOnShiftSection } from './NotOnShiftSection.tsx'
import { OnShiftSection } from './OnShiftSection.tsx'
import { RolesLegend } from './RolesLegend.tsx'
import { WeekStrip, type WeekStripDay } from './WeekStrip.tsx'

export type WorkScheduleTodayBodyProps = {
    weekDays: WeekStripDay[]
    selectedDate: string
    onSelectDate: (date: string) => void
    onShift: WorkScheduleShiftEmployee[]
    notOnShift: WorkScheduleAbsenceGroup[]
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
 * вышел» (это уже обрабатывает сам `OnShiftSection`) или «все на смене» (это обрабатывает сама
 * `NotOnShiftSection`, скрываясь при пустом `notOnShift`, см. её комментарий).
 *
 * `FooterNote` (узел `A5SbT` -> `Footer Note`) — последний элемент тела, тем же порядком, что и в
 * дизайне: под обеими секциями, а не только под `OnShiftSection` — подсказка описывает поведение
 * обеих (лента недели выше и тап по сотруднику в любой из секций).
 */
export function WorkScheduleTodayBody({
    weekDays,
    selectedDate,
    onSelectDate,
    onShift,
    notOnShift,
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
                date={selectedDate}
                onShiftCount={onShiftCount}
                totalEmployees={totalEmployees}
                totalHours={totalHours}
            />
            <NotOnShiftSection notOnShift={notOnShift} date={selectedDate} />
            <FooterNote />
        </>
    )
}
