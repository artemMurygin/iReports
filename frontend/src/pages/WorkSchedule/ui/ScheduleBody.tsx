import type { MonthlyWorkScheduleResponse } from 'ireports-contracts'

import type { ScheduleDayMeta } from '../model/scheduleDays.ts'
import type { WorkScheduleTab } from '../model/tabs.ts'
import { LegendRow } from './LegendRow.tsx'
import { RoleLegendRow } from './RoleLegendRow.tsx'
import { RolesTable } from './RolesTable.tsx'
import { ScheduleEmptyState } from './ScheduleEmptyState.tsx'
import { ScheduleTable } from './ScheduleTable.tsx'

export type ScheduleBodyProps = {
    tab: WorkScheduleTab
    days: ScheduleDayMeta[]
    employees: MonthlyWorkScheduleResponse['employees']
    dayAggregates: MonthlyWorkScheduleResponse['days']
    totalHours: number
    hasData: boolean
    periodLabel: string
    /** Сотрудник, на чью строку прокрутить и подсветить таблицу — переход по `?employeeId=` с
     * мобильного экрана «Отдел сегодня» (план, Фаза 9). `null` — обычное открытие страницы. */
    highlightedEmployeeId: number | null
}

/**
 * `WorkSchedulePage`'s `Layout` `body` слот — легенда + таблица/empty state и условие, какое из
 * двух показать, теперь ещё и какую из двух пар легенда/таблица (Фаза 8: «Календарь» vs «Роли»,
 * узлы `Cko6w`/`vO4tI`). Вынесено из `WorkSchedulePage` тем же приёмом, что и `SalesPlanBody`
 * (frontend/CLAUDE.md, "Mediator-компонент для страниц с несколькими виджетами": медиатор не
 * должен содержать условный рендер) — весь выбор варианта живёт здесь, а не в `WorkSchedulePage`.
 *
 * Обе вкладки рендерят один и тот же `employees`/`dayAggregates`/`totalHours` из уже загруженного
 * ответа `GET /v1/work-schedule` (план, Фаза 8 — «данные берутся из того же... отдельный запрос не
 * нужен»), различаются только презентационные компоненты (`ScheduleTable`/`RolesTable`,
 * `LegendRow`/`RoleLegendRow`).
 */
function ScheduleBody({
    tab,
    days,
    employees,
    dayAggregates,
    totalHours,
    hasData,
    periodLabel,
    highlightedEmployeeId,
}: ScheduleBodyProps) {
    if (!hasData) {
        return (
            <>
                {tab === 'CALENDAR' ? <LegendRow /> : <RoleLegendRow />}
                <ScheduleEmptyState periodLabel={periodLabel} />
            </>
        )
    }

    return tab === 'CALENDAR' ? (
        <>
            <LegendRow />
            <ScheduleTable
                days={days}
                employees={employees}
                dayAggregates={dayAggregates}
                totalHours={totalHours}
                highlightedEmployeeId={highlightedEmployeeId}
            />
        </>
    ) : (
        <>
            <RoleLegendRow />
            <RolesTable
                days={days}
                employees={employees}
                dayAggregates={dayAggregates}
                totalHours={totalHours}
                highlightedEmployeeId={highlightedEmployeeId}
            />
        </>
    )
}

export { ScheduleBody }
