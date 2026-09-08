import { queryOptions } from '@tanstack/react-query'
import type { ChangeTaskStatusRequest, ListEmployeesResponse, Task, TaskStatus } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError, extractApiErrorMessage } from '@/shared/errors/apiError.ts'

/**
 * replace-bitrix-task-integration, tasks.md группа 12 — карточка статуса самостоятельной задачи
 * (`GET /v1/tasks/:id`) и self-service переход по графу `TaskStatus` (`PATCH /v1/tasks/:id/status`,
 * specs/tasks/spec.md «Ответственный сотрудник ведёт задачу до готовности» / «Проверка и закрытие
 * задачи руководителем» / «Возврат с доработки в работу»). `actorEmployeeId` резолвится backend'ом
 * из сессии (см. WHY в `ChangeTaskStatusHttpController`) — тело запроса несёт только `targetStatus`.
 *
 * `getAssigneeEmployees` — своя копия справочника сотрудников (`GET /v1/directory/employees`), не
 * импорт `features/CreateTask`/`features/TargetDirectory`: features не могут кросс-импортировать
 * друг друга (frontend/CLAUDE.md, `boundaries/dependencies`) — тот же приём дублирования читающего
 * запроса, что уже задокументирован в `features/CreateTask/model/api.ts`'s `getEmployees`. Нужна
 * здесь только для того, чтобы показать имя ответственного (`Task.assigneeEmployeeId` — просто
 * число, без имени) — отдельный `queryKey`, не пересекающийся с кэшем других фич.
 */
export const TASKS_QUERY_KEY_PREFIX = ['tasks'] as const

export const tasksApi = {
    get: (taskId: string) =>
        queryOptions({
            queryKey: [...TASKS_QUERY_KEY_PREFIX, taskId],
            queryFn: ({ signal }): Promise<Task> =>
                apiInstance
                    .get<Task>(`/v1/tasks/${taskId}`, { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить задачу ' + error)
                    }),
        }),

    // Ошибка НЕ оборачивается в ApiError — по прецеденту `EmployeeBalance/model/api.ts`'s
    // `createTransaction`: недопустимый переход (`InvalidTaskTransitionException`) отдаёт 400 с
    // читаемым `message`, который читает `extractApiErrorMessage` в самом UI-обработчике мутации.
    transition: (taskId: string, payload: ChangeTaskStatusRequest): Promise<Task> =>
        apiInstance.patch<Task>(`/v1/tasks/${taskId}/status`, payload).then((r) => r.data),

    getAssigneeEmployees: () =>
        queryOptions({
            queryKey: ['task-status-control', 'employees'],
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

export function readTransitionErrorMessage(error: unknown): string {
    return extractApiErrorMessage(error, 'Не удалось изменить статус задачи')
}

export type { TaskStatus }
