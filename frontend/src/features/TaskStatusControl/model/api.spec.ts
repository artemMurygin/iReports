import { describe, expect, it, vi, beforeEach } from 'vitest'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import {
    TASKS_QUERY_KEY_PREFIX,
    TASK_COMMENTS_QUERY_KEY_PREFIX,
    TASK_LINKS_QUERY_KEY_PREFIX,
    tasksApi,
    commentsApi,
    linksApi,
    salaryReferenceApi,
} from './api.ts'

// add-task-salary-rule-links-comments, tasks.md 21.1 — мокаем axios-инстанс, а не сеть, тем же
// приёмом, что и `TaskStatusControl.spec.tsx`.
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

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

// tasks.md 21.1: commentsApi.list/create, linksApi.list/create/remove, salaryReferenceApi.getRule/
// getAccrual — queryKey-форма + фактический сетевой запрос (URL/метод/тело), сетевые ошибки в ApiError.
describe('commentsApi', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
        vi.mocked(axiosInstance.post).mockReset()
    })

    it('list: queryKey prefixed by TASK_COMMENTS_QUERY_KEY_PREFIX and differs by taskId', () => {
        const a = commentsApi.list('task-1').queryKey
        const b = commentsApi.list('task-2').queryKey
        expect(a.slice(0, TASK_COMMENTS_QUERY_KEY_PREFIX.length)).toEqual([...TASK_COMMENTS_QUERY_KEY_PREFIX])
        expect(a).not.toEqual(b)
    })

    it('list: queryFn calls GET /v1/tasks/:id/comments', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: [] })
        const { queryFn } = commentsApi.list('task-1')
        // @ts-expect-error queryFn signature includes required context we don't need here
        await queryFn({ signal: undefined })
        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/tasks/task-1/comments', { signal: undefined })
    })

    it('list: wraps a network error in ApiError', async () => {
        vi.mocked(axiosInstance.get).mockRejectedValue(new Error('network down'))
        const { queryFn } = commentsApi.list('task-1')
        // @ts-expect-error see above
        await expect(queryFn({ signal: undefined })).rejects.toThrow(/Не удалось загрузить/)
    })

    it('create: calls POST /v1/tasks/:id/comments with the text', async () => {
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: { id: 'c1' } })
        await commentsApi.create('task-1', 'Готово')
        expect(axiosInstance.post).toHaveBeenCalledWith('/v1/tasks/task-1/comments', { text: 'Готово' })
    })
})

describe('linksApi', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
        vi.mocked(axiosInstance.post).mockReset()
        vi.mocked(axiosInstance.delete).mockReset()
    })

    it('list: queryKey prefixed by TASK_LINKS_QUERY_KEY_PREFIX and differs by taskId', () => {
        const a = linksApi.list('task-1').queryKey
        const b = linksApi.list('task-2').queryKey
        expect(a.slice(0, TASK_LINKS_QUERY_KEY_PREFIX.length)).toEqual([...TASK_LINKS_QUERY_KEY_PREFIX])
        expect(a).not.toEqual(b)
    })

    it('list: queryFn calls GET /v1/tasks/:id/links', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: [] })
        const { queryFn } = linksApi.list('task-1')
        // @ts-expect-error see above
        await queryFn({ signal: undefined })
        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/tasks/task-1/links', { signal: undefined })
    })

    it('create: calls POST /v1/tasks/:id/links with url and optional label', async () => {
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: { id: 'l1' } })
        await linksApi.create('task-1', 'https://example.com', 'Результат')
        expect(axiosInstance.post).toHaveBeenCalledWith('/v1/tasks/task-1/links', {
            url: 'https://example.com',
            label: 'Результат',
        })
    })

    it('remove: calls DELETE /v1/tasks/:id/links/:linkId', async () => {
        vi.mocked(axiosInstance.delete).mockResolvedValue({ data: undefined })
        await linksApi.remove('task-1', 'link-1')
        expect(axiosInstance.delete).toHaveBeenCalledWith('/v1/tasks/task-1/links/link-1')
    })
})

describe('salaryReferenceApi', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
    })

    it('getRule: calls GET /v1/service/accounting/salary-rules/by-task/:taskId for service', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: { id: 'rule-1' } })
        const { queryFn } = salaryReferenceApi.getRule('service', 'task-1')
        // @ts-expect-error see above
        await queryFn({ signal: undefined })
        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/service/accounting/salary-rules/by-task/task-1', {
            signal: undefined,
        })
    })

    it('getRule: calls GET /v1/shop/accounting/salary-rules/by-task/:taskId for shop', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: null })
        const { queryFn } = salaryReferenceApi.getRule('shop', 'task-1')
        // @ts-expect-error see above
        await queryFn({ signal: undefined })
        expect(axiosInstance.get).toHaveBeenCalledWith('/v1/shop/accounting/salary-rules/by-task/task-1', {
            signal: undefined,
        })
    })

    it('getRule: a 404 resolves to null instead of throwing', async () => {
        vi.mocked(axiosInstance.get).mockRejectedValue({
            isAxiosError: true,
            response: { status: 404 },
        })
        const { queryFn } = salaryReferenceApi.getRule('service', 'task-1')
        // @ts-expect-error see above
        await expect(queryFn({ signal: undefined })).resolves.toBeNull()
    })

    it('getAccrual: calls GET .../salary-accrual-lines/by-task/:taskId for the given direction', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: { id: 'line-1' } })
        const { queryFn } = salaryReferenceApi.getAccrual('service', 'task-1')
        // @ts-expect-error see above
        await queryFn({ signal: undefined })
        expect(axiosInstance.get).toHaveBeenCalledWith(
            '/v1/service/accounting/salary-accrual-lines/by-task/task-1',
            { signal: undefined },
        )
    })

    it('getAccrual: a 404 resolves to null instead of throwing', async () => {
        vi.mocked(axiosInstance.get).mockRejectedValue({
            isAxiosError: true,
            response: { status: 404 },
        })
        const { queryFn } = salaryReferenceApi.getAccrual('shop', 'task-1')
        // @ts-expect-error see above
        await expect(queryFn({ signal: undefined })).resolves.toBeNull()
    })
})
