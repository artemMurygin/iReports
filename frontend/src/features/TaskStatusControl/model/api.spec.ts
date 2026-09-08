import { describe, expect, it } from 'vitest'

import { TASKS_QUERY_KEY_PREFIX, tasksApi } from './api.ts'

// replace-bitrix-task-integration, tasks.md 12.1: `tasksApi.get` — query options factory для
// GET /v1/tasks/:id. По прецеденту `EmployeeBalance/model/api.spec.ts` — проверяем только
// queryKey (стабильность/различение по id), не сетевой запрос (это делает `TaskStatusControl.spec.tsx`).
describe('tasksApi.get queryKey', () => {
    it('is prefixed by TASKS_QUERY_KEY_PREFIX', () => {
        const { queryKey } = tasksApi.get('task-1')
        expect(queryKey.slice(0, TASKS_QUERY_KEY_PREFIX.length)).toEqual([...TASKS_QUERY_KEY_PREFIX])
    })

    it('differs between two different task ids (no cross-task cache collision)', () => {
        const first = tasksApi.get('task-1').queryKey
        const second = tasksApi.get('task-2').queryKey
        expect(first).not.toEqual(second)
    })

    it('is stable for the same task id', () => {
        const first = tasksApi.get('task-1').queryKey
        const second = tasksApi.get('task-1').queryKey
        expect(first).toEqual(second)
    })
})
