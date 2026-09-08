import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { GetGoodsTurnoverReportResponse, ListProductCategoriesResponse, ListWarehousesResponse } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'
import { useGoodsTurnoverReportPage } from './useGoodsTurnoverReportPage.ts'

// TDD задачи 15.3-15.6 (openspec/changes/service-turnover-report): смена периода/склада/категории
// должна инициировать нужные запросы (смена периода — новый GET отчёта, смена склада/категории —
// без нового сетевого запроса, только фильтрация уже загруженного отчёта, см. комментарий в
// model/api.ts), а `isInitialLoad`/`isRefreshing` вычисляются поверх `useQuery` с
// `placeholderData: keepPreviousData`, по образцу `useServicesAnalytics`
// (`pages/ServicesReport/model/useServicesAnalytics.tsx`). Мок axios-инстанса единым диспетчером
// по URL — тот же приём, что `pages/SalesPlan/model/useSalesPlanPage.spec.tsx`.
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn() },
}))

const WAREHOUSES: ListWarehousesResponse = [
    { id: 1, name: 'Склад №1' },
    { id: 2, name: 'Склад №2' },
]

const CATEGORIES: ListProductCategoriesResponse = [
    { id: 10, name: 'Дисплеи', parentId: null },
    { id: 11, name: 'iPhone', parentId: 10 },
]

function makeReport(period: string): GetGoodsTurnoverReportResponse {
    return {
        period,
        lines: [
            {
                categoryId: 10,
                categoryName: 'Дисплеи',
                categoryParentId: null,
                warehouseId: 1,
                warehouseName: 'Склад №1',
                outcomeQuantity: 5,
                outcomeSum: 50000,
                stockQuantity: 3,
                stockSum: 30000,
                turnoverRatio: 1.5,
            },
        ],
    }
}

// Отдельная фикстура для тестов фильтрации `rows` (задача 19): та же пара категорий
// (`Дисплеи` -> `iPhone`), но на ДВУХ складах — проверяет, что `rows` оставляет только строки
// выбранного склада, а выбор родительской категории включает и вложенную (17.4/18.4).
function makeMultiWarehouseReport(period: string): GetGoodsTurnoverReportResponse {
    return {
        period,
        lines: [
            {
                categoryId: 10,
                categoryName: 'Дисплеи',
                categoryParentId: null,
                warehouseId: 1,
                warehouseName: 'Склад №1',
                outcomeQuantity: 5,
                outcomeSum: 50000,
                stockQuantity: 3,
                stockSum: 30000,
                turnoverRatio: 1.5,
            },
            {
                categoryId: 11,
                categoryName: 'iPhone',
                categoryParentId: 10,
                warehouseId: 1,
                warehouseName: 'Склад №1',
                outcomeQuantity: 2,
                outcomeSum: 20000,
                stockQuantity: 1,
                stockSum: 10000,
                turnoverRatio: 1.2,
            },
            {
                categoryId: 10,
                categoryName: 'Дисплеи',
                categoryParentId: null,
                warehouseId: 2,
                warehouseName: 'Склад №2',
                outcomeQuantity: 9,
                outcomeSum: 90000,
                stockQuantity: 4,
                stockSum: 40000,
                turnoverRatio: null,
            },
        ],
    }
}

function renderPage() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    return renderHook(() => useGoodsTurnoverReportPage(), { wrapper })
}

describe('useGoodsTurnoverReportPage', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
    })

    function mockBackend(
        options: { report?: (period: string) => GetGoodsTurnoverReportResponse; periodStatus?: 'OPEN' | 'CLOSED' } = {},
    ) {
        const buildReport = options.report ?? makeReport
        const status = options.periodStatus ?? 'OPEN'
        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url === '/v1/service/warehouse/product-categories') return Promise.resolve({ data: CATEGORIES })
            if (url === '/v1/service/warehouse/warehouses') return Promise.resolve({ data: WAREHOUSES })
            if (url.startsWith('/v1/service/warehouse/goods-turnover-report/')) {
                const period = url.split('/').pop()!
                return Promise.resolve({ data: buildReport(period) })
            }
            // Задача 19 (openspec/changes/service-turnover-report): статус расчётного периода
            // направления `service` — переиспользованный `GET .../period/:period`
            // (`features/AccountingPeriod`), теперь тоже вызывается этим хуком (бейдж закрытого
            // периода в Filter Row). Открытый по умолчанию — большинство тестов ниже про это не
            // спрашивают.
            if (url.startsWith('/v1/service/accounting/period/')) {
                const period = url.split('/').pop()!
                return Promise.resolve({
                    data: { direction: 'service', period, status, closedBy: null, closedAt: null },
                })
            }
            return Promise.reject(new Error(`Unexpected GET ${url}`))
        })
    }

    it('isInitialLoad=true до первого ответа отчёта, false после — и автоматически выбирает первый склад из справочника', async () => {
        mockBackend()
        const { result } = renderPage()

        expect(result.current.isInitialLoad).toBe(true)

        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))
        expect(result.current.report?.lines).toHaveLength(1)
        expect(result.current.warehouses).toEqual(WAREHOUSES)
        expect(result.current.categories).toEqual(CATEGORIES)
        expect(result.current.warehouseId).toBe(1)
    })

    it('смена periода вызывает новый GET отчёта с новым периодом в URL, isRefreshing=true пока грузится, старые строки остаются видны (placeholderData)', async () => {
        mockBackend()
        const { result } = renderPage()

        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))
        const initialCallCount = vi.mocked(axiosInstance.get).mock.calls.length

        act(() => result.current.setPeriod('2026-08'))

        // Пока летит новый запрос — старые данные ещё видны, значит isInitialLoad не взводится
        // заново (только isRefreshing).
        expect(result.current.isInitialLoad).toBe(false)
        expect(result.current.report?.period).not.toBe('2026-08')

        await waitFor(() => expect(result.current.report?.period).toBe('2026-08'))

        expect(vi.mocked(axiosInstance.get).mock.calls.length).toBeGreaterThan(initialCallCount)
        expect(vi.mocked(axiosInstance.get)).toHaveBeenCalledWith(
            '/v1/service/warehouse/goods-turnover-report/2026-08',
            expect.anything(),
        )
    })

    it('смена склада НЕ вызывает новый сетевой запрос — только меняет warehouseId в состоянии (фильтрация уже загруженного отчёта)', async () => {
        mockBackend()
        const { result } = renderPage()

        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))
        const callCountBefore = vi.mocked(axiosInstance.get).mock.calls.length

        act(() => result.current.setWarehouseId(2))

        expect(result.current.warehouseId).toBe(2)
        expect(vi.mocked(axiosInstance.get).mock.calls.length).toBe(callCountBefore)
    })

    it('смена категории НЕ вызывает новый сетевой запрос — только меняет categoryId в состоянии', async () => {
        mockBackend()
        const { result } = renderPage()

        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))
        const callCountBefore = vi.mocked(axiosInstance.get).mock.calls.length

        expect(result.current.categoryId).toBe(null)
        act(() => result.current.setCategoryId(10))

        expect(result.current.categoryId).toBe(10)
        expect(vi.mocked(axiosInstance.get).mock.calls.length).toBe(callCountBefore)
    })

    it('rows фильтрует report.lines по выбранному складу, и по выбранной категории вместе со всеми вложенными', async () => {
        mockBackend({ report: makeMultiWarehouseReport })
        const { result } = renderPage()

        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))
        // Дефолтный склад — первый из справочника (id 1): обе строки склада №1, склад №2 отфильтрован.
        expect(result.current.rows.map((r) => r.categoryId).sort()).toEqual([10, 11])

        act(() => result.current.setWarehouseId(2))
        expect(result.current.rows.map((r) => r.categoryId)).toEqual([10])

        act(() => {
            result.current.setWarehouseId(1)
            result.current.setCategoryId(10)
        })
        // Родительская категория (10, «Дисплеи») включает и вложенную (11, «iPhone») — но не строки чужого склада.
        expect(result.current.rows.map((r) => r.categoryId).sort()).toEqual([10, 11])

        act(() => result.current.setCategoryId(11))
        expect(result.current.rows.map((r) => r.categoryId)).toEqual([11])
    })

    it('isClosed отражает статус AccountingPeriod направления service за выбранный период (GET .../period/:period)', async () => {
        mockBackend({ periodStatus: 'CLOSED' })
        const { result } = renderPage()

        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))
        await waitFor(() => expect(result.current.isClosed).toBe(true))
    })

    it('retry вызывает повторный запрос отчёта (кнопка «Повторить» в GoodsTurnoverErrorState)', async () => {
        mockBackend()
        const { result } = renderPage()

        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))
        const callCountBefore = vi.mocked(axiosInstance.get).mock.calls.length

        await act(async () => {
            await result.current.retry()
        })

        expect(vi.mocked(axiosInstance.get).mock.calls.length).toBeGreaterThan(callCountBefore)
    })
})
