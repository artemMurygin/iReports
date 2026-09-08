import { useMutation } from '@tanstack/react-query'

import { api } from './api.ts'

/** `POST /v1/tasks` — единственный вход создания задачи (design.md решение 1/4). Тонкая обёртка над
 * `useMutation`, по прецеденту `useCreateMotivationSchema.ts`/`useLogout.ts` — потребитель
 * (`CreateTaskForm`, а позже мастер создания правила `TaskCompletion`, раздел 14 tasks.md) читает
 * `isPending`/`isSuccess`/`error`/`data` как обычный хук, не зная о форме `queryFn`. */
export function useCreateTask() {
    return useMutation({ mutationFn: api.createTask })
}
