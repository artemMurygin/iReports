import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { SalaryAccrualResponse } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { SALARY_ACCRUALS_QUERY_KEY_PREFIX } from './api.ts'
import { useSetTaskCompletionLineReward } from './useAccrualMutations.ts'

/**
 * add-task-based-salary-rule, раздел 24 tasks.md (24.1): `useSetTaskCompletionLineReward`
 * (по образцу `useAdjustLine`) вызывает `api.setTaskCompletionLineReward(direction, accrualId,
 * lineId, { amount, comment })` — PATCH .../salary_accruals/:id/lines/:lineId/task-reward
 * (contracts 2.3/13.3/18.3) — и инвалидирует данные начисления при успехе, тем же приёмом,
 * что и остальные мутации в этом файле (`useInvalidateSalaryAccrualsData`).
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const ACCRUAL_RESPONSE = {
    id: 'accrual-1',
    direction: 'service',
    period: '2026-09',
    employeeId: 42,
    employeeName: 'Иванов Иван',
    departmentId: null,
    status: 'DRAFT',
    isDismissed: false,
    total: 5000,
    linesCount: 1,
    accruedLinesCount: 0,
    createdAt: new Date('2026-09-01'),
    lines: [],
} as unknown as SalaryAccrualResponse

function renderWithClient(queryClient: QueryClient, direction: 'service' | 'shop', accrualId: string) {
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useSetTaskCompletionLineReward(direction, accrualId), { wrapper })
}

describe('useSetTaskCompletionLineReward', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.patch).mockReset()
    })

    it('вызывает PATCH .../salary_accruals/:id/lines/:lineId/task-reward с amount/comment (service)', async () => {
        vi.mocked(axiosInstance.patch).mockResolvedValue({ data: ACCRUAL_RESPONSE })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const { result } = renderWithClient(queryClient, 'service', 'accrual-1')

        await act(async () => {
            await result.current.mutateAsync({ lineId: 'line-1', amount: 5000, comment: 'Задача выполнена в срок' })
        })

        expect(axiosInstance.patch).toHaveBeenCalledWith(
            '/v1/service/accounting/salary_accruals/accrual-1/lines/line-1/task-reward',
            { amount: 5000, comment: 'Задача выполнена в срок' },
        )
    })

    it('собирает путь под направление shop', async () => {
        vi.mocked(axiosInstance.patch).mockResolvedValue({ data: ACCRUAL_RESPONSE })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const { result } = renderWithClient(queryClient, 'shop', 'accrual-2')

        await act(async () => {
            await result.current.mutateAsync({ lineId: 'line-2', amount: 1000, comment: 'ok' })
        })

        expect(axiosInstance.patch).toHaveBeenCalledWith(
            '/v1/shop/accounting/salary_accruals/accrual-2/lines/line-2/task-reward',
            { amount: 1000, comment: 'ok' },
        )
    })

    it('инвалидирует данные начислений при успехе', async () => {
        vi.mocked(axiosInstance.patch).mockResolvedValue({ data: ACCRUAL_RESPONSE })
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
        const { result } = renderWithClient(queryClient, 'service', 'accrual-1')

        await act(async () => {
            await result.current.mutateAsync({ lineId: 'line-1', amount: 5000, comment: 'Готово' })
        })

        expect(invalidateSpy).toHaveBeenCalledWith(
            expect.objectContaining({ queryKey: SALARY_ACCRUALS_QUERY_KEY_PREFIX }),
        )
    })
})
