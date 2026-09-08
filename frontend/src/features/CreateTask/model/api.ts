import { queryOptions } from '@tanstack/react-query'
import type { CreateTaskRequest, CreateTaskResponse, ListEmployeesResponse } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError, extractApiErrorMessage } from '@/shared/errors/apiError.ts'

/**
 * replace-bitrix-task-integration, раздел 11 tasks.md — `features/CreateTask` не знает про
 * зарплатные правила (design.md решение 2/4, specs/tasks/spec.md «Задача — полностью
 * самостоятельная сущность») и переиспользуется и на общей странице `/tasks`, и как Шаг 1 мастера
 * создания правила `TaskCompletion` (`pages/SalaryRuleDetail`, раздел 14 tasks.md).
 *
 * `createTask` оформлен как обычная async-функция, а не `queryOptions` — по прецеденту
 * `pages/SalaryRules/service/model/api.ts`'s `createMotivationSchema` (`queryOptions` — только для
 * чтения, см. frontend/CLAUDE.md "Query options factory"), разворачивается в
 * `useMutation({ mutationFn: api.createTask })` в `useCreateTask.ts`.
 *
 * `getEmployees` — своя копия справочника сотрудников (`GET /v1/directory/employees`), не импорт
 * `features/TargetDirectory`: features не могут кросс-импортировать друг друга (frontend/CLAUDE.md,
 * `boundaries/dependencies`) — тот же приём дублирования читающего запроса между фичами, что уже
 * задокументирован в `features/SalaryRuleForm/service/model/api.ts`'s `getOrderTypes`. Отдельный
 * `queryKey`, не пересекающийся с `EMPLOYEES_QUERY_KEY` той фичи — эта фича не обязана знать о её
 * кэше и наоборот.
 */
export const api = {
    createTask: (payload: CreateTaskRequest): Promise<CreateTaskResponse> =>
        apiInstance
            .post<CreateTaskResponse>('/v1/tasks', payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось создать задачу'))
            }),

    getEmployees: () =>
        queryOptions({
            queryKey: ['create-task', 'employees'],
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
