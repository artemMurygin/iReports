import { queryOptions } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import type {
    EmployeeWithServiceAccountResponse,
    ListDepartmentsResponse,
    ListEmployeesWithServiceAccountResponse,
    SetEmployeeServiceAccountRequest,
    SetEmployeeServiceAccountResponse,
} from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/**
 * Данные страницы настроек «Служебные аккаунты» (docs/employee-ordering-and-salary-filter,
 * Фаза 4). Тот же паттерн, что `pages/EmployeeIdentity/model/api.ts`: `queryOptions` для чтения,
 * обычные async-функции для мутации.
 *
 * `getEmployees` берёт `GET /v1/directory/employees/service-accounts` (Фаза 4), а НЕ обычный
 * `GET /v1/directory/employees` — тот намеренно исключает служебные аккаунты из ответа (см. WHY
 * в contracts/commands/directory.ts), поэтому на странице, где надо и увидеть, и переключить сам
 * признак, он не годится.
 */

function serverMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const message = (error.response?.data as { message?: unknown } | undefined)?.message
        if (typeof message === 'string' && message.trim() !== '') return message
        if (Array.isArray(message) && message.length > 0) return message.join('; ')
    }
    return String(error)
}

const EMPLOYEES_QUERY_KEY = ['service-accounts', 'employees'] as const

export const api = {
    getEmployees: () =>
        queryOptions({
            queryKey: EMPLOYEES_QUERY_KEY,
            queryFn: ({ signal }): Promise<ListEmployeesWithServiceAccountResponse> =>
                apiInstance
                    .get<ListEmployeesWithServiceAccountResponse>('/v1/directory/employees/service-accounts', {
                        signal,
                    })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить список сотрудников ' + serverMessage(error))
                    }),
        }),

    getDepartments: () =>
        queryOptions({
            queryKey: ['service-accounts', 'departments'],
            staleTime: 5 * 60 * 1000,
            queryFn: ({ signal }): Promise<ListDepartmentsResponse> =>
                apiInstance
                    .get<ListDepartmentsResponse>('/v1/directory/departments', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить список отделов ' + serverMessage(error))
                    }),
        }),

    setServiceAccount: (id: number, payload: SetEmployeeServiceAccountRequest): Promise<SetEmployeeServiceAccountResponse> =>
        apiInstance
            .patch<SetEmployeeServiceAccountResponse>(`/v1/directory/employees/${id}/service-account`, payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError('Не удалось изменить признак «служебный»: ' + serverMessage(error))
            }),
}

export { EMPLOYEES_QUERY_KEY }
export type { EmployeeWithServiceAccountResponse }
