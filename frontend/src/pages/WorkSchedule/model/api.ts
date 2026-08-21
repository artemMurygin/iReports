import { queryOptions } from '@tanstack/react-query'
import type { MonthlyWorkScheduleResponse } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

export const api = {
    // GET /v1/work-schedule?month=&departmentId= (Фаза 3, docs/employee-work-schedule) — вся
    // таблица «сотрудники × дни месяца» одним запросом. `departmentId` не передан (`null`) — как
    // и на бэкенде, значит «сотрудники всех отделов»; qs.stringify (paramsSerializer в
    // axios.instance.ts) сам опускает undefined-значения из query, поэтому фильтр по отделу не
    // нужно собирать вручную.
    getMonthlySchedule: (month: string, departmentId: number | null) =>
        queryOptions({
            queryKey: ['work-schedule', 'month', month, departmentId],
            queryFn: ({ signal }) =>
                apiInstance
                    .get<MonthlyWorkScheduleResponse>('/v1/work-schedule', {
                        signal,
                        params: { month, departmentId: departmentId ?? undefined },
                    })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить график работы ' + error)
                    }),
        }),
}
