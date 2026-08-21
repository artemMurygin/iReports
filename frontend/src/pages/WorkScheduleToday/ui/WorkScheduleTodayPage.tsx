import { useWorkScheduleTodayPage } from '../model/useWorkScheduleTodayPage.ts'
import { Layout } from './Layout.tsx'
import { PageHeader } from './PageHeader.tsx'
import { WorkScheduleTodayBody } from './WorkScheduleTodayBody.tsx'

/**
 * Pencil: design/sallary-first-iteration.pen, узел `A5SbT` (`График работы · Мобильный (Отдел
 * сегодня)`) — мобильный экран состава смены на выбранный день.
 *
 * Каркас Фазы 9 плана (`docs/employee-work-schedule`): лента дней недели, счётчики «На смене»/
 * «Часы»/«Роли на смене» и список сотрудников на смене. Блок «Не на смене» и переход с карточки
 * сотрудника на его график — задача следующего шага (Фаза 9b), здесь не реализованы.
 *
 * Чистый медиатор (frontend/CLAUDE.md): всё состояние — в `useWorkScheduleTodayPage`, весь
 * условный рендер — в `WorkScheduleTodayBody`; этот компонент только раскладывает результат хука
 * по слотам `Layout`.
 */
export function WorkScheduleTodayPage() {
    const {
        weekDays,
        onSelectDate,
        onShift,
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
                    onSelectDate={onSelectDate}
                    onShift={onShift}
                    roleCounts={roleCounts}
                    onShiftCount={onShiftCount}
                    totalEmployees={totalEmployees}
                    totalHours={totalHours}
                />
            }
        />
    )
}
