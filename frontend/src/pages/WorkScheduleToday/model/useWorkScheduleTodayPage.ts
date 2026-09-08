import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'

import { api } from './api.ts'
import { resolveSelectedDayIndex } from './selectedDayIndex.ts'
import { totalEmployeesOfShift } from './shiftStats.ts'
import { getTodayIso } from './today.ts'
import { buildWeekDays } from './weekDays.ts'

/**
 * Владеет всем состоянием мобильного экрана «Отдел сегодня» (узел `A5SbT`, `design/sallary-
 * first-iteration.pen`) — плоский объект по тому же соглашению, что и `useWorkSchedulePage`
 * (frontend/CLAUDE.md, "`model`-хуки с плоским объектом состояния").
 *
 * `todayIso` вычисляется один раз при монтировании (`useState` с инициализатором) — тот же приём
 * и та же причина, что и в `useWorkSchedulePage`: «сегодня» не должно скакать в рамках одной
 * открытой страницы.
 *
 * Департамент этот экран не фильтрует (`departmentId: null` = «все отделы», как и на бэкенде,
 * см. `api.ts`) — в дизайне (`A5SbT`) на мобильном экране нет пикера отдела, в отличие от
 * десктопной таблицы (`ControlRow`); добавление фильтра — вне описанного шага задачи.
 *
 * Все 7 дней ленты запрашиваются параллельно одним и тем же `GET /v1/work-schedule/shift`
 * (`useQueries`, один вызов на дату) вместо одного запроса на выбранный день плюс отдельного
 * агрегата на месяц: у экрана ровно один источник данных (Фаза 4, ENDPOINTS.md), и переключение
 * дня становится мгновенным — данные уже в кэше TanStack Query, а не перезапрашиваются по клику.
 */
export function useWorkScheduleTodayPage() {
    const [todayIso] = useState<string>(getTodayIso)
    const weekDays = useMemo(() => buildWeekDays(todayIso), [todayIso])
    const [selectedDate, setSelectedDate] = useState<string>(todayIso)

    const shiftQueries = useQueries({
        queries: weekDays.map((day) => api.getShift(day.date, null)),
    })

    const selectedIndex = resolveSelectedDayIndex(weekDays, selectedDate)
    const selectedQuery = shiftQueries[selectedIndex]
    const shift = selectedQuery.data

    // Счётчик «людей в смене» под каждым днём ленты — из уже загруженного (или ещё не
    // загруженного, тогда `null`) ответа того же дня, без дополнительного запроса.
    const weekDaysWithCounts = weekDays.map((day, index) => ({
        ...day,
        peopleOnShift: shiftQueries[index].data?.onShift.length ?? null,
        isSelected: index === selectedIndex,
    }))

    const isInitialLoad = selectedQuery.isLoading && shift === undefined
    const isRefreshing = selectedQuery.isFetching && !isInitialLoad

    return {
        weekDays: weekDaysWithCounts,
        selectedDate: weekDays[selectedIndex].date,
        onSelectDate: setSelectedDate,
        onShift: shift?.onShift ?? [],
        notOnShift: shift?.notOnShift ?? [],
        roleCounts: shift?.roleCounts ?? [],
        onShiftCount: shift?.onShift.length ?? 0,
        totalEmployees: shift ? totalEmployeesOfShift(shift) : 0,
        totalHours: shift?.totalHours ?? 0,
        isInitialLoad,
        isRefreshing,
        dataVersion: selectedQuery.dataUpdatedAt,
        error: selectedQuery.error instanceof Error ? selectedQuery.error.message : null,
    }
}
