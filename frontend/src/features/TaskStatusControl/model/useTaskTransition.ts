import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TaskStatus } from 'ireports-contracts'

import { TASKS_QUERY_KEY_PREFIX, tasksApi } from './api.ts'

/**
 * Self-service переход статуса (`PATCH /v1/tasks/:id/status`) — ответственный/руководитель, по
 * графу `getTransitionActions`. Успешный переход инвалидирует весь префикс `['tasks']`: и карточку
 * этой самой задачи (`['tasks', taskId]`), и список `/tasks` (`pages/Tasks`'s `tasksApi.list`,
 * ключ которого начинается с того же префикса) — сама задача не знает, кто на неё сейчас смотрит.
 */
export function useTaskTransition(taskId: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (targetStatus: TaskStatus) => tasksApi.transition(taskId, { targetStatus }),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY_PREFIX })
        },
    })
}
