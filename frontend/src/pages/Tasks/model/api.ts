import { queryOptions } from '@tanstack/react-query'
import type { ListEmployeesResponse, ListTasksQuery, Task } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/**
 * replace-bitrix-task-integration, tasks.md группа 13 — список задач страницы `/tasks`
 * (`GET /v1/tasks?status&direction`, оба фильтра необязательны — specs/tasks/spec.md «Задача видна
 * в интерфейсе на любой стадии жизненного цикла»).
 *
 * Ключ списка ОБЯЗАН начинаться с `'tasks'` — `features/TaskStatusControl`'s `useTaskTransition`
 * (tasks.md группа 12) уже инвалидирует ровно этот префикс на успешный переход статуса
 * (`TASKS_QUERY_KEY_PREFIX = ['tasks']` там же), рассчитывая, что список страницы `/tasks` (этот
 * файл) подхватит новый статус без ручной рефетч-логики — см. WHY в `useTaskTransition.ts`.
 */
export const TASKS_LIST_QUERY_KEY_PREFIX = ['tasks', 'list'] as const

export const tasksApi = {
    list: (query: ListTasksQuery) =>
        queryOptions({
            queryKey: [...TASKS_LIST_QUERY_KEY_PREFIX, query.status ?? null, query.direction ?? null],
            queryFn: ({ signal }): Promise<Task[]> =>
                apiInstance
                    .get<Task[]>('/v1/tasks', { params: query, signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить список задач ' + error)
                    }),
        }),

    // Своя копия справочника сотрудников (не импорт `features/CreateTask`/`features/
    // TaskStatusControl` — оба уже дублируют этот же запрос по той же причине, см. их `model/api.ts`):
    // нужна только для того, чтобы показать имя ответственного в строке/карточке списка
    // (`Task.assigneeEmployeeId` — просто число).
    getAssigneeEmployees: () =>
        queryOptions({
            queryKey: ['tasks-page', 'employees'],
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
