import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { SalesPerformanceResponse } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { HARDCODED_DEPARTMENT_ID, useSalesPlan } from './useSalesPlan.ts'

/**
 * Мокаем сам axios-инстанс, как `useEditPlanForm.spec.tsx`/`useEmployeeBalancePage.spec.tsx` —
 * `useSalesPlan` дергает несколько разных эндпоинтов (salesPerformance, service-categories,
 * order-types) одним хуком.
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn() },
}))

function makePerformanceRow(
    category: string | null,
    overrides: Partial<SalesPerformanceResponse['plan']> = {},
): SalesPerformanceResponse {
    return {
        direction: 'service',
        period: '2026-09',
        department: HARDCODED_DEPARTMENT_ID,
        category,
        plan: {
            id: `plan-${category ?? 'none'}`,
            direction: 'service',
            department: HARDCODED_DEPARTMENT_ID,
            category,
            period: '2026-09',
            turnover: 100000,
            margin: 20000,
            orderTypeIds: [],
            source: 'MANUAL',
            status: 'CREATED',
            approvedBy: null,
            approvedAt: null,
            sortOrder: null,
            createdAt: new Date('2026-09-01'),
            updatedAt: new Date('2026-09-01'),
            ...overrides,
        },
        fact: { turnover: 0, margin: 0, marginPercent: 0, cost: 0, quantity: 0, averageCheck: 0, percentCompletion: 0 },
        prognose: { turnover: 0, margin: 0, marginPercent: 0, quantity: 0, percentCompletion: 0 },
    }
}

function renderSalesPlan(period = '2026-09') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return { ...renderHook(() => useSalesPlan('service', period), { wrapper }), queryClient }
}

describe('useSalesPlan — доверяет порядку строк, пришедшему от API (Фаза 3, docs/sales-plan-row-drag-and-drop-reorder)', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
    })

    it('сохраняет порядок performance-массива как есть, без пересортировки на клиенте', async () => {
        // Бэкенд уже сортирует по sortOrder (Фаза 1) — здесь порядок ответа нарочно не
        // алфавитный и не по числовому sortOrder, чтобы поймать любую случайную клиентскую
        // сортировку (например, по имени категории или по id), если бы она была.
        const performance = [
            makePerformanceRow('cat-z', { sortOrder: 0 }),
            makePerformanceRow('cat-a', { sortOrder: 1 }),
            makePerformanceRow('cat-m', { sortOrder: 2 }),
        ]
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url.startsWith('/v1/service/sales/salesPerformance/')) return Promise.resolve({ data: performance })
            if (url.startsWith('/v1/service/reports/service-categories')) return Promise.resolve({ data: [] })
            if (url.startsWith('/v1/service/reports/order-type')) return Promise.resolve({ data: [] })
            return Promise.reject(new Error(`Unexpected GET ${url}`))
        })

        const { result } = renderSalesPlan()
        await waitFor(() => expect(result.current.rows).toHaveLength(3))

        expect(result.current.rows.map((row) => row.category)).toEqual(['cat-z', 'cat-a', 'cat-m'])
    })

    it('строка без сохранённого sortOrder (новая категория), возвращённая бэкендом последней, остаётся последней', async () => {
        // Гарантия "последней" — ответственность бэкенда (Фаза 1, orderSalesPlansByTemplate);
        // здесь проверяется только то, что фронтенд её не переставит обратно вперёд.
        const performance = [
            makePerformanceRow('cat-a', { sortOrder: 0 }),
            makePerformanceRow('cat-b', { sortOrder: 1 }),
            makePerformanceRow('cat-new', { sortOrder: null }),
        ]
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url.startsWith('/v1/service/sales/salesPerformance/')) return Promise.resolve({ data: performance })
            if (url.startsWith('/v1/service/reports/service-categories')) return Promise.resolve({ data: [] })
            if (url.startsWith('/v1/service/reports/order-type')) return Promise.resolve({ data: [] })
            return Promise.reject(new Error(`Unexpected GET ${url}`))
        })

        const { result } = renderSalesPlan()
        await waitFor(() => expect(result.current.rows).toHaveLength(3))

        expect(result.current.rows.map((row) => row.category)).toEqual(['cat-a', 'cat-b', 'cat-new'])
        expect(result.current.rows.at(-1)?.plan.sortOrder).toBeNull()
    })

    it('строки другого отдела отфильтровываются, но порядок оставшихся строк не переставляется', async () => {
        const performance = [
            makePerformanceRow('cat-z', { sortOrder: 0 }),
            { ...makePerformanceRow('other-dept', { sortOrder: 0 }), department: HARDCODED_DEPARTMENT_ID + 1 },
            makePerformanceRow('cat-a', { sortOrder: 1 }),
        ]
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url.startsWith('/v1/service/sales/salesPerformance/')) return Promise.resolve({ data: performance })
            if (url.startsWith('/v1/service/reports/service-categories')) return Promise.resolve({ data: [] })
            if (url.startsWith('/v1/service/reports/order-type')) return Promise.resolve({ data: [] })
            return Promise.reject(new Error(`Unexpected GET ${url}`))
        })

        const { result } = renderSalesPlan()
        await waitFor(() => expect(result.current.rows).toHaveLength(2))

        expect(result.current.rows.map((row) => row.category)).toEqual(['cat-z', 'cat-a'])
    })
})
