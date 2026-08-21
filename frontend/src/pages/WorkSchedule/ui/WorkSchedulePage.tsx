import { useWorkSchedulePage } from '../model/useWorkSchedulePage.ts'
import { ControlRow } from './ControlRow.tsx'
import { Layout } from './Layout.tsx'
import { PageHeader } from './PageHeader.tsx'
import { ScheduleBody } from './ScheduleBody.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, узлы `Cko6w` (`График работы · Календарь`) и
 * `vO4tI` (`· Роли`) — режим просмотра обеих вкладок (Фаза 6 + Фаза 8, read-only часть) + поповер
 * редактирования дня по клику на ячейку календаря (Фаза 7, `ScheduleTable.tsx` -> `ui/DayEditorPopover`).
 * Назначение роли рабочему дню из ячейки вкладки «Роли» — Фаза 8b, по-прежнему вне скоупа (см.
 * `RolesTable.tsx`'s комментарий).
 *
 * Чистый медиатор (frontend/CLAUDE.md): всё состояние — в `useWorkSchedulePage`, весь условный
 * рендер — в `ScheduleBody`; этот компонент только раскладывает результат хука по слотам `Layout`.
 */
export function WorkSchedulePage() {
    const {
        month,
        setMonth,
        departmentId,
        setDepartmentId,
        tab,
        setTab,
        departments,
        isDepartmentsLoading,
        days,
        employees,
        dayAggregates,
        totalHours,
        hasData,
        periodLabel,
        todayLabel,
        isInitialLoad,
        isRefreshing,
        dataVersion,
        error,
    } = useWorkSchedulePage()

    return (
        <Layout
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            dataVersion={dataVersion}
            error={error}
            header={
                <div className="flex flex-col gap-4">
                    <PageHeader todayLabel={todayLabel} />
                    <ControlRow
                        month={month}
                        onMonthChange={setMonth}
                        periodLabel={periodLabel}
                        departments={departments}
                        departmentId={departmentId}
                        onDepartmentIdChange={setDepartmentId}
                        isDepartmentsLoading={isDepartmentsLoading}
                        tab={tab}
                        onTabChange={setTab}
                    />
                </div>
            }
            body={
                <ScheduleBody
                    tab={tab}
                    days={days}
                    employees={employees}
                    dayAggregates={dayAggregates}
                    totalHours={totalHours}
                    hasData={hasData}
                    periodLabel={periodLabel}
                />
            }
        />
    )
}
