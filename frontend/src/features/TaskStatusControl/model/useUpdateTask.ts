import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UpdateTaskRequest } from 'ireports-contracts'

import { TASKS_QUERY_KEY_PREFIX, tasksApi } from './api.ts'

/**
 * Частичное обновление задачи (`PATCH /v1/tasks/:id`, edit-task tasks.md группа 5) — по прецеденту
 * `useTaskTransition`. Успешное обновление инвалидирует весь префикс `['tasks']`: и карточку этой
 * самой задачи (`['tasks', taskId]`), и список `/tasks` (`pages/Tasks`'s `tasksApi.list`, ключ
 * которого начинается с того же префикса) — сама задача не знает, кто на неё сейчас смотрит.
 */
export function useUpdateTask(taskId: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (payload: UpdateTaskRequest) => tasksApi.update(taskId, payload),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY_PREFIX })
        },
    })
}
