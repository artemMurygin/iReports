import { useWorkScheduleTodayPage } from '../model/useWorkScheduleTodayPage.ts'
import { Layout } from './Layout.tsx'
import { PageHeader } from './PageHeader.tsx'
import { WorkScheduleTodayBody } from './WorkScheduleTodayBody.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, узел `A5SbT` (`График работы · Мобильный (Отдел
 * сегодня)`) — мобильный экран состава смены на выбранный день.
 *
 * План, Фаза 9 (`docs/employee-work-schedule`): лента дней недели, счётчики «На смене»/«Часы»/
 * «Роли на смене», список сотрудников на смене (Фаза 9a), блок «Не на смене» с группировкой по
 * причине и переход с карточки сотрудника (что на смене, что не на смене) на его график —
 * `EmployeeRow`/`AbsenceGroupRow`, `model/employeeScheduleLink.ts`.
 *
 * Чистый медиатор (frontend/CLAUDE.md): всё состояние — в `useWorkScheduleTodayPage`, весь
 * условный рендер — в `WorkScheduleTodayBody`; этот компонент только раскладывает результат хука
 * по слотам `Layout`.
 */
export function WorkScheduleTodayPage() {
    const {
        weekDays,
        selectedDate,
        onSelectDate,
        onShift,
        notOnShift,
        roleCounts,
        onShiftCount,
        totalEmployees,
        totalHours,
        isInitialLoad,
        isRefreshing,
        dataVersion,
        error,
    } = useWorkScheduleTodayPage()

    return (
        <Layout
            isInitialLoad={isInitialLoad}
            isRefreshing={isRefreshing}
            dataVersion={dataVersion}
            error={error}
            header={<PageHeader />}
            body={
                <WorkScheduleTodayBody
                    weekDays={weekDays}
                    selectedDate={selectedDate}
                    onSelectDate={onSelectDate}
                    onShift={onShift}
                    notOnShift={notOnShift}
                    roleCounts={roleCounts}
                    onShiftCount={onShiftCount}
                    totalEmployees={totalEmployees}
                    totalHours={totalHours}
                />
            }
        />
    )
}
