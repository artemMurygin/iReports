import { useQuery } from '@tanstack/react-query'

import { salaryRuleTaskApi } from './taskApi.ts'

/** Название уже привязанной к правилу `TaskCompletion` задачи (`draft.taskId`), для
 * `TaskCompletionRuleFields`'s "Задача" — `enabled: false` while there is no task yet (`taskId`
 * `null`/`''`, see `RuleDraft.taskId`'s own comment for what that state means). */
export function useRuleTask(taskId: string | null) {
    return useQuery({
        ...salaryRuleTaskApi.get(taskId ?? ''),
        enabled: Boolean(taskId),
    })
}
