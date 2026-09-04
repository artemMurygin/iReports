import { queryOptions } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import type {
    CreateEmployeeIdentityRequest,
    EmployeeIdentityResponse,
    ListDepartmentsResponse,
    ListEmployeesWithServiceAccountResponse,
    UpdateEmployeeIdentityRequest,
} from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/**
 * Данные экрана «Связи сотрудников» (Pencil: design/sallary-first-iteration.pen, фрейм
 * `CpVvw`). Три чтения по паттерну `pages/SalaryRules/model/api.ts` — справочники Bitrix
 * (`/v1/directory/*`) и весь список связей разом (`GET /v1/employee-identity`), плюс три
 * мутации CRUD обычными async-функциями рядом (`queryOptions` — только для чтения, см.
 * frontend/CLAUDE.md, «Query options factory»); разворачиваются в `useMutation` в
 * `model/useIdentityMutations.ts`.
 *
 * Список связей берётся целиком, а не по `GET /v1/employee-identity/employee/:employeeId` на
 * каждого сотрудника: таблица показывает сразу всех сотрудников Bitrix, поэтому поштучный
 * вариант дал бы N запросов на один рендер. `/unmatched` тоже не используется — сотрудники
 * без связей вычисляются как разница «справочник минус связи», и та же группировка нужна для
 * карточки «Покрытие ERP» (см. `model/useEmployeeIdentities.ts`).
 */

// Общий префикс ключей модуля: мутации инвалидируют только список связей
// (`IDENTITIES_QUERY_KEY`), справочники Bitrix от них не меняются.
const IDENTITIES_QUERY_KEY = ['employee-identity', 'list'] as const

/**
 * Сообщение сервера вместо сырого «AxiosError: Request failed with status code 409».
 * Нужно ровно для одного сценария из задачи — дубль «сотрудник × система × тип × значение»:
 * бэкенд объясняет конфликт текстом, и этот текст должен доехать до пользователя, а не
 * потеряться внутри `ApiError`. `message` у Nest бывает и массивом (ошибки валидации).
 */
function serverMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const message = (error.response?.data as { message?: unknown } | undefined)?.message
        if (typeof message === 'string' && message.trim() !== '') return message
        if (Array.isArray(message) && message.length > 0) return message.join('; ')
    }
    return String(error)
}

export const api = {
    getIdentities: () =>
        queryOptions({
            queryKey: IDENTITIES_QUERY_KEY,
            queryFn: ({ signal }): Promise<EmployeeIdentityResponse[]> =>
                apiInstance
                    .get<EmployeeIdentityResponse[]>('/v1/employee-identity', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить связи сотрудников ' + serverMessage(error))
                    }),
        }),

    // GET .../employees/service-accounts (docs/employee-ordering-and-salary-filter, Фаза 4), а
    // НЕ обычный GET .../employees: тот теперь (Фаза 3) намеренно исключает служебные
    // аккаунты — а эта страница обязана продолжать их видеть (PRD "Не в скоупе": "Скрытие
    // служебных сотрудников за пределами зарплатного раздела"). Сам флаг isServiceAccount
    // здесь не используется (строка таблицы типизирована `EmployeeResponse`, см.
    // `model/useEmployeeIdentities.ts` — расширенный ответ структурно ему соответствует).
    getEmployees: () =>
        queryOptions({
            queryKey: ['employee-identity', 'employees'],
            staleTime: 5 * 60 * 1000,
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
            queryKey: ['employee-identity', 'departments'],
            staleTime: 5 * 60 * 1000,
            queryFn: ({ signal }): Promise<ListDepartmentsResponse> =>
                apiInstance
                    .get<ListDepartmentsResponse>('/v1/directory/departments', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить список отделов ' + serverMessage(error))
                    }),
        }),

    createIdentity: (payload: CreateEmployeeIdentityRequest): Promise<EmployeeIdentityResponse> =>
        apiInstance
            .post<EmployeeIdentityResponse>('/v1/employee-identity', payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError('Не удалось создать связь: ' + serverMessage(error))
            }),

    updateIdentity: (id: string, payload: UpdateEmployeeIdentityRequest): Promise<EmployeeIdentityResponse> =>
        apiInstance
            .patch<EmployeeIdentityResponse>(`/v1/employee-identity/${id}`, payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError('Не удалось изменить связь: ' + serverMessage(error))
            }),

    deleteIdentity: (id: string): Promise<void> =>
        apiInstance
            .delete(`/v1/employee-identity/${id}`)
            .then(() => undefined)
            .catch((error) => {
                throw new ApiError('Не удалось удалить связь: ' + serverMessage(error))
            }),
}

export { IDENTITIES_QUERY_KEY }
