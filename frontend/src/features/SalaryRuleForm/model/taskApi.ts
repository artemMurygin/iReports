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
 *
 * `remove` — add-task-rule-task-lifecycle: `DELETE /v1/tasks/:id`, полное безвозвратное удаление
 * (не мягкая отмена — та живёт на бэкенде отдельно, `CancelTaskForRuleDeletionService`, и
 * срабатывает только для уже сохранённого правила). Используется и явной кнопкой "Удалить задачу"
 * (`useDeleteRuleTask`), и автоматической очисткой осиротевшей задачи при размонтировании формы
 * без сохранения правила (`useTaskLinkPanels`'s unmount-эффект).
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

    remove: (taskId: string): Promise<void> =>
        apiInstance
            .delete(`/v1/tasks/${taskId}`)
            .then(() => undefined)
            .catch((error) => {
                throw new ApiError('Не удалось удалить задачу ' + error)
            }),
}
