import { useWorkSchedulePage } from '../model/useWorkSchedulePage.ts'
import { ControlRow } from './ControlRow.tsx'
import { Layout } from './Layout.tsx'
import { PageHeader } from './PageHeader.tsx'
import { ScheduleBody } from './ScheduleBody.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, узел `Cko6w` (`График работы · Календарь`) —
 * режим просмотра (Фаза 6 плана "График работы сотрудников"). Поповер редактирования дня и
 * вкладка «Роли» узла `Cko6w` в этой фазе не реализуются (см. `ControlRow`'s комментарий).
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
                    />
                </div>
            }
            body={
                <ScheduleBody
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
