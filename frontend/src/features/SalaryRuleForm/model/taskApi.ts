import { queryOptions } from '@tanstack/react-query'
import type { Task } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/**
 * `GET /v1/tasks/:id` — своя копия чтения задачи (не импорт `features/TaskStatusControl`'s
 * `tasksApi.get`): features не могут кросс-импортировать друг друга (frontend/CLAUDE.md,
 * `boundaries/dependencies`) — тот же приём дублирования читающего запроса, что уже
 * задокументирован в `features/CreateTask/model/api.ts`'s `getEmployees`. Нужен здесь только для
 * того, чтобы показать название уже привязанной к правилу `TaskCompletion` задачи вместо её id
 * (`TaskCompletionRuleFields`'s "Задача") — отдельный `queryKey`, не пересекающийся с кэшем других
 * фич.
 */
export const salaryRuleTaskApi = {
    get: (taskId: string) =>
        queryOptions({
            queryKey: ['salary-rule-form', 'task', taskId],
            queryFn: ({ signal }): Promise<Task> =>
                apiInstance
                    .get<Task>(`/v1/tasks/${taskId}`, { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить задачу ' + error)
                    }),
        }),
}
