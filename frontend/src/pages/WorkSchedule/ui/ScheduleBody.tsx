import type { MonthlyWorkScheduleResponse } from 'ireports-contracts'

import type { ScheduleDayMeta } from '../model/scheduleDays.ts'
import { LegendRow } from './LegendRow.tsx'
import { ScheduleEmptyState } from './ScheduleEmptyState.tsx'
import { ScheduleTable } from './ScheduleTable.tsx'

export type ScheduleBodyProps = {
    days: ScheduleDayMeta[]
    employees: MonthlyWorkScheduleResponse['employees']
    dayAggregates: MonthlyWorkScheduleResponse['days']
    totalHours: number
    hasData: boolean
    periodLabel: string
}

/**
 * `WorkSchedulePage`'s `Layout` `body` slot — легенда + таблица/empty state и условие, какое из
 * двух показать. Вынесено из `WorkSchedulePage` тем же приёмом, что и `SalesPlanBody`
 * (frontend/CLAUDE.md, "Mediator-компонент для страниц с несколькими виджетами": медиатор не
 * должен содержать условный рендер).
 */
function ScheduleBody({ days, employees, dayAggregates, totalHours, hasData, periodLabel }: ScheduleBodyProps) {
    return (
        <>
            <LegendRow />

            {hasData ? (
                <ScheduleTable days={days} employees={employees} dayAggregates={dayAggregates} totalHours={totalHours} />
            ) : (
                <ScheduleEmptyState periodLabel={periodLabel} />
            )}
        </>
    )
}

export { ScheduleBody }
