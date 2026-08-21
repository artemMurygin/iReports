import { queryOptions } from '@tanstack/react-query'
import type { WorkScheduleShiftResponse } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

// GET /v1/work-schedule/shift?date=&departmentId= (Фаза 4, docs/employee-work-schedule) —
// единственный источник данных мобильного экрана «Отдел сегодня» (узел `A5SbT`): состав смены
// выбранного дня ленты недели и число людей в смене каждого из остальных шести дней —
// `useWorkScheduleTodayPage` вызывает эти же `queryOptions` семь раз, по одному на день недели
// (см. её комментарий), а не отдельно читает месячный агрегат `GET /v1/work-schedule` (Фаза 3) —
// у этого экрана ровно один источник данных.
export const WORK_SCHEDULE_SHIFT_QUERY_KEY_PREFIX = ['work-schedule', 'shift'] as const

export const api = {
    getShift: (date: string, departmentId: number | null) =>
        queryOptions({
            queryKey: [...WORK_SCHEDULE_SHIFT_QUERY_KEY_PREFIX, date, departmentId],
            queryFn: ({ signal }) =>
                apiInstance
                    .get<WorkScheduleShiftResponse>('/v1/work-schedule/shift', {
                        signal,
                        params: { date, departmentId: departmentId ?? undefined },
                    })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить состав смены ' + error)
                    }),
        }),
}
