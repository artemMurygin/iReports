import { queryOptions } from '@tanstack/react-query'
import type {
    MonthlyWorkScheduleResponse,
    UpsertWorkScheduleEntryRequest,
    WorkScheduleEntryResponse,
} from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError, extractApiErrorMessage } from '@/shared/errors/apiError.ts'

// Общий префикс queryKey всех запросов страницы графика — единственный источник true и для
// `getMonthlySchedule` ниже, и для инвалидации после сохранения дня (`useSaveWorkScheduleEntry.ts`,
// Фаза 7): `invalidateQueries({ queryKey: WORK_SCHEDULE_QUERY_KEY_PREFIX })` матчит месяц
// (`[...prefix, 'month', ...]`) по префиксу без точного совпадения остальных элементов ключа
// (см. TanStack Query, "Query Matching with invalidateQueries"). Одна константа вместо двух копий
// строки `'work-schedule'` — иначе переименование одной из них молча ломает пересчёт итогов.
export const WORK_SCHEDULE_QUERY_KEY_PREFIX = ['work-schedule'] as const

export const api = {
    // GET /v1/work-schedule?month=&departmentId= (Фаза 3, docs/employee-work-schedule) — вся
    // таблица «сотрудники × дни месяца» одним запросом. `departmentId` не передан (`null`) — как
    // и на бэкенде, значит «сотрудники всех отделов»; qs.stringify (paramsSerializer в
    // axios.instance.ts) сам опускает undefined-значения из query, поэтому фильтр по отделу не
    // нужно собирать вручную.
    getMonthlySchedule: (month: string, departmentId: number | null) =>
        queryOptions({
            queryKey: [...WORK_SCHEDULE_QUERY_KEY_PREFIX, 'month', month, departmentId],
            queryFn: ({ signal }) =>
                apiInstance
                    .get<MonthlyWorkScheduleResponse>('/v1/work-schedule', {
                        signal,
                        params: { month, departmentId: departmentId ?? undefined },
                    })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError(extractApiErrorMessage(error, 'Не удалось загрузить график работы'))
                    }),
        }),

    // PUT /v1/work-schedule/entries (Фаза 1, идемпотентный upsert по (employeeId, date)) — правка
    // одной ячейки из поповера редактирования дня (Фаза 7). Не `queryOptions` — как и
    // `updateSalesPlan` в `features/SalesPlan/model/api.ts`, обычная async-функция, разворачиваемая
    // в `useMutation` (`useSaveWorkScheduleEntry.ts`).
    upsertEntry: (payload: UpsertWorkScheduleEntryRequest): Promise<WorkScheduleEntryResponse> =>
        apiInstance
            .put<WorkScheduleEntryResponse>('/v1/work-schedule/entries', payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось сохранить день графика'))
            }),
}
