import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { useSalaryRuleActivation } from './useSalaryRuleActivation.ts'
import { SALARY_RULE_DETAIL_QUERY_KEY_PREFIX } from './api.ts'

/**
 * Soft-деактивация/восстановление ОДНОГО правила из `SalaryRuleDetailsPanel` — по прецеденту
 * `TaskStatusControl/model/useTaskLinks.spec.tsx`: мокаем `@/shared/api/axios.instance.ts` и
 * `sonner`, проверяем и запрошенный URL, и что по успеху инвалидируется и запрос самого правила
 * (`salaryRuleApi.get`'s `queryKey`), и запрос мотивационной схемы (по префиксу
 * `['motivation-schema']` — панель не знает `schemaId` правила напрямую).
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { post: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderActivation(ruleId: string, direction: 'service' | 'shop', queryClient: QueryClient) {
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useSalaryRuleActivation(ruleId, direction), { wrapper })
}

function makeQueryClient() {
    return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

describe('useSalaryRuleActivation', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.post).mockReset()
    })

    it('deactivate вызывает POST .../salary-rules/:ruleId/deactivate и инвалидирует оба кэша', async () => {
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: undefined })
        const queryClient = makeQueryClient()
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderActivation('rule-1', 'service', queryClient)

        act(() => result.current.deactivate())

        await waitFor(() =>
            expect(axiosInstance.post).toHaveBeenCalledWith('/v1/service/accounting/salary-rules/rule-1/deactivate'),
        )
        await waitFor(() =>
            expect(invalidateSpy).toHaveBeenCalledWith(
                expect.objectContaining({ queryKey: [...SALARY_RULE_DETAIL_QUERY_KEY_PREFIX, 'service', 'rule-1'] }),
            ),
        )
        expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['motivation-schema'] }))
    })

    it('activate вызывает POST .../salary-rules/:ruleId/activate (домен shop) и инвалидирует оба кэша', async () => {
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: undefined })
        const queryClient = makeQueryClient()
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        const { result } = renderActivation('rule-1', 'shop', queryClient)

        act(() => result.current.activate())

        await waitFor(() =>
            expect(axiosInstance.post).toHaveBeenCalledWith('/v1/shop/accounting/salary-rules/rule-1/activate'),
        )
        await waitFor(() =>
            expect(invalidateSpy).toHaveBeenCalledWith(
                expect.objectContaining({ queryKey: [...SALARY_RULE_DETAIL_QUERY_KEY_PREFIX, 'shop', 'rule-1'] }),
            ),
        )
        expect(invalidateSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['motivation-schema'] }))
    })

    it('isPending истинно, пока запрос деактивации не завершился', async () => {
        let resolve!: (value: { data: undefined }) => void
        vi.mocked(axiosInstance.post).mockReturnValue(
            new Promise((r) => {
                resolve = r
            }),
        )
        const queryClient = makeQueryClient()

        const { result } = renderActivation('rule-1', 'service', queryClient)

        act(() => result.current.deactivate())

        await waitFor(() => expect(result.current.isPending).toBe(true))

        resolve({ data: undefined })

        await waitFor(() => expect(result.current.isPending).toBe(false))
    })
})
