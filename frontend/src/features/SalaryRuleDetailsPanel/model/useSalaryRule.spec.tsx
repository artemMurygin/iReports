import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

import { useSalaryRule } from './useSalaryRule.ts'

/**
 * add-task-salary-rule-links-comments, tasks.md группа 28 (28.1): `useSalaryRule(ruleId, direction)`
 * — read-only запрос правила для `features/SalaryRuleDetailsPanel` (design.md решение 5,
 * `GetSalaryRuleService.execute`, `GET /v1/{direction}/accounting/salary-rules/:ruleId`). По
 * прецеденту `CreateTask/model/useCreateTask.spec.tsx` — мокаем `@/shared/api/axios.instance.ts`,
 * проверяем и запрошенный URL, и оборачивание ошибки backend в `ApiError`.
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn() },
}))

function renderSalaryRule(ruleId: string, direction: 'service' | 'shop', queryClient: QueryClient) {
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useSalaryRule(ruleId, direction), { wrapper })
}

function makeQueryClient() {
    return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

const RULE_DETAIL = {
    id: 'rule-1',
    type: 'TaskCompletion',
    name: 'Закрытие задачи',
    targetRole: 'ENGINEER',
    config: {
        taskTitleTemplate: 'Сделать X',
        isRecurring: false,
        deadlineTemplate: '2026-09-30',
        defaultAmount: 5000,
        taskIdByPeriod: { '2026-09': 'task-1' },
    },
    direction: 'service',
    motivationSchemaName: 'Инженеры',
}

describe('useSalaryRule', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
    })

    it('запрашивает GET /v1/{direction}/accounting/salary-rules/:ruleId и отдаёт правило', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: RULE_DETAIL })

        const { result } = renderSalaryRule('rule-1', 'service', makeQueryClient())

        expect(result.current.isLoading).toBe(true)
        await waitFor(() => expect(result.current.isLoading).toBe(false))

        expect(axiosInstance.get).toHaveBeenCalledWith(
            '/v1/service/accounting/salary-rules/rule-1',
            expect.objectContaining({ signal: expect.anything() }),
        )
        expect(result.current.rule).toEqual(RULE_DETAIL)
        expect(result.current.error).toBeNull()
    })

    it('запрашивает домен shop, когда direction === "shop"', async () => {
        vi.mocked(axiosInstance.get).mockResolvedValue({ data: { ...RULE_DETAIL, direction: 'shop' } })

        renderSalaryRule('rule-1', 'shop', makeQueryClient())

        await waitFor(() =>
            expect(axiosInstance.get).toHaveBeenCalledWith(
                '/v1/shop/accounting/salary-rules/rule-1',
                expect.objectContaining({ signal: expect.anything() }),
            ),
        )
    })

    it('оборачивает ошибку backend в ApiError с сообщением из тела ответа', async () => {
        vi.mocked(axiosInstance.get).mockRejectedValue({
            isAxiosError: true,
            response: { data: { message: 'Правило не найдено' } },
        })

        const { result } = renderSalaryRule('missing-rule', 'service', makeQueryClient())

        await waitFor(() => expect(result.current.error).not.toBeNull())

        expect(result.current.error).toBeInstanceOf(ApiError)
        expect(result.current.error?.message).toBe('Правило не найдено')
        expect(result.current.rule).toBeUndefined()
    })

    it('падает с общим сообщением, если backend не вернул message', async () => {
        vi.mocked(axiosInstance.get).mockRejectedValue(new Error('network down'))

        const { result } = renderSalaryRule('rule-1', 'service', makeQueryClient())

        await waitFor(() => expect(result.current.error).not.toBeNull())

        expect(result.current.error?.message).toBe('Не удалось загрузить зарплатное правило')
    })
})
