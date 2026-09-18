import { useMutation, useQueryClient } from '@tanstack/react-query'

import { TASKS_QUERY_KEY_PREFIX, tasksApi } from './api.ts'

/**
 * Реализует часть change delete-task-frontend (delete-task-frontend): безвозвратное удаление задачи
 * (`DELETE /v1/tasks/:id`, tasks.md группа 1) — по прецеденту `useUpdateTask`. Успешное удаление
 * инвалидирует весь префикс `['tasks']`: и карточку этой задачи, и список `/tasks`.
 */
export function useDeleteTask(taskId: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: () => tasksApi.remove(taskId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY_PREFIX })
        },
    })
}
