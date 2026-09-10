import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CatalogResponse, ShopStoresResponse } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'
import { useShopGoodsTurnoverReportPage } from './useShopGoodsTurnoverReportPage.ts'

// TDD задачи 18.1-18.4 (openspec/changes/add-department-head-salary-rules): FR5, BREAKING — ответ
// `GET /v1/shop/warehouse/goods-turnover-report/:period` меняет форму с голого массива строк на
// `{lines, totals}`. Этот хук — единственный потребитель эндпоинта на фронтенде (кроме самой
// таблицы, которая получает уже готовые `rows`/`total` через него) — должен читать строки из
// `.lines` (а не трактовать весь объект ответа как массив строк) и отдавать `total` — запись
// `.totals` для текущего `warehouseId`, без локального пересчёта (`summarizeShopGoodsTurnoverRows`,
// удалена этим change). Мок axios — тот же приём, что `../useGoodsTurnoverReportPage.spec.tsx`
// (направление `service`).
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn() },
}))

const STORES: ShopStoresResponse = [
    { id: 'w1', name: 'Склад №1' },
    { id: 'w2', name: 'Склад №2' },
]

const CATALOG: CatalogResponse = [{ id: 'c10', name: 'Дисплеи', pathName: 'Дисплеи', children: [] }]

// `turnoverSum`/`stockSum` — в копейках на проводе (contracts/commands/shop-goods-turnover-report.ts,
// zod-схема сама переводит в рубли через `.transform`) — здесь то же, что бэкенд реально отдаёт.
function makeRawShopReport(warehouses: string[]) {
    return {
        lines: warehouses.map((warehouseId) => ({
            categoryId: 'c10',
            warehouseId,
            turnoverQuantity: 5,
            turnoverSum: 5_000_000,
            stockQuantity: 3,
            stockSum: 3_000_000,
            coefficient: 1.5,
        })),
        totals: warehouses.map((warehouseId, i) => ({
            warehouseId,
            // Числа заведомо отличаются от суммы по `lines` каждого склада, чтобы тест не мог
            // случайно совпасть при локальном пересчёте вместо чтения готового `totals`.
            turnoverSum: 7_000_000 + i * 1_000_000,
            stockSum: 4_000_000,
            stockQuantity: 4,
            coefficient: i === 0 ? 1.75 : null,
        })),
    }
}

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useShopGoodsTurnoverReportPage(), { wrapper })
}

describe('useShopGoodsTurnoverReportPage', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
    })

    function mockBackend(report: ReturnType<typeof makeRawShopReport> = makeRawShopReport(['w1'])) {
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/shop/warehouse/catalog') return Promise.resolve({ data: CATALOG })
            if (url === '/v1/shop/warehouse/stores') return Promise.resolve({ data: STORES })
            if (url.startsWith('/v1/shop/warehouse/goods-turnover-report/')) return Promise.resolve({ data: report })
            if (url.startsWith('/v1/shop/accounting/period/')) {
                const period = url.split('/').pop()!
                return Promise.resolve({ data: { direction: 'shop', period, status: 'OPEN', closedBy: null, closedAt: null } })
            }
            return Promise.reject(new Error(`Unexpected GET ${url}`))
        })
    }

    it('rows читает строки из report.lines новой формы {lines, totals}, а не трактует весь ответ как массив', async () => {
        mockBackend(makeRawShopReport(['w1']))
        const { result } = renderPage()

        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))
        expect(result.current.rows).toHaveLength(1)
        expect(result.current.rows[0]).toMatchObject({ categoryId: 'c10', warehouseId: 'w1', turnoverSum: 50000 })
    })

    // FR5 of add-department-head-salary-rules.
    it('total отдаёт запись report.totals для выбранного склада (в рублях, не в копейках), не локальный пересчёт по rows', async () => {
        mockBackend(makeRawShopReport(['w1', 'w2']))
        const { result } = renderPage()

        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))
        expect(result.current.warehouseId).toBe('w1')
        expect(result.current.total).toEqual({ warehouseId: 'w1', turnoverSum: 70000, stockSum: 40000, stockQuantity: 4, coefficient: 1.75 })

        act(() => result.current.setWarehouseId('w2'))
        expect(result.current.total).toEqual({ warehouseId: 'w2', turnoverSum: 80000, stockSum: 40000, stockQuantity: 4, coefficient: null })
    })

    it('total равен null, пока склад не встретился ни в одной записи totals', async () => {
        mockBackend(makeRawShopReport(['w1']))
        const { result } = renderPage()

        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))
        act(() => result.current.setWarehouseId('w2'))

        expect(result.current.total).toBeNull()
    })
})
