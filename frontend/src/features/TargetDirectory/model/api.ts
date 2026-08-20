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
            queryKey: ['target-directory', 'employees'],
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
