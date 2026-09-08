import { queryOptions } from '@tanstack/react-query'
import type { ListDepartmentsResponse, ListEmployeesResponse } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/**
 * Moved here from `pages/SalaryRules/model/api.ts` (originally Фаза 1, docs/salary-schema-creation-ui)
 * — the Bitrix directory of departments/employees is real business data-fetching (not a pure
 * constant), and `pages/SalaryRuleList` (docs/salary-schema-list-ui) needs the exact same two
 * queries for its "Отдел"/"Сотрудник" filters. A page can't import another page's `model`
 * (frontend/CLAUDE.md), so this became a `features/TargetDirectory` module instead — see this
 * feature's `index.ts` for why it has no root UI component of its own.
 */
// Экспортирован для переиспользования вне `useQuery` (frontend/CLAUDE.md, тот же приём, что и
// `WORK_SCHEDULE_QUERY_KEY_PREFIX` в `pages/WorkSchedule/model/api.ts`) — reorder-мутация
// сотрудников (`pages/WorkSchedule/model/useReorderEmployees.ts`, docs/employee-ordering-and-
// salary-filter, Фаза 2) кладёт свежий ответ PATCH .../employees/order прямо в этот кэш
// (`queryClient.setQueryData`), чтобы все страницы, использующие `useEmployees()` (справочник
// выбора сотрудника при создании отчёта и т.д.), сразу увидели новый порядок без лишнего GET.
export const EMPLOYEES_QUERY_KEY = ['target-directory', 'employees'] as const

export const api = {
    getDepartments: () =>
        queryOptions({
            queryKey: ['target-directory', 'departments'],
            staleTime: 5 * 60 * 1000,
            queryFn: ({ signal }): Promise<ListDepartmentsResponse> =>
                apiInstance
                    .get<ListDepartmentsResponse>('/v1/directory/departments', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить список отделов ' + error)
                    }),
        }),

    getEmployees: () =>
        queryOptions({
            queryKey: EMPLOYEES_QUERY_KEY,
            staleTime: 5 * 60 * 1000,
            queryFn: ({ signal }): Promise<ListEmployeesResponse> =>
                apiInstance
                    .get<ListEmployeesResponse>('/v1/directory/employees', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить список сотрудников ' + error)
                    }),
        }),
}
