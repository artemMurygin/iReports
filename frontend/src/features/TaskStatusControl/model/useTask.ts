import { useQuery } from '@tanstack/react-query'

import { tasksApi } from './api.ts'

/** Карточка задачи (`GET /v1/tasks/:id`) — используется и `/tasks`, и `SalaryRuleDetail`. */
export function useTask(taskId: string) {
    return useQuery(tasksApi.get(taskId))
}
