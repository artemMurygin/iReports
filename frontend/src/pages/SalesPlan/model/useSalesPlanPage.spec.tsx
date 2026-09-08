import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type {
    AccountingPeriodResponse,
    SalesPerformanceResponse,
    SalesPlanTemplateResponse,
    UpdateSalesPlanOrderRequest,
} from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'
import { useEditPlanForm } from '@/features/SalesPlan/ui/EditPlanModal/model/useEditPlanForm.ts'

import { useSalesPlanPage } from './useSalesPlanPage.ts'

/**
 * Интеграционный тест Фазы 3 (docs/sales-plan-row-drag-and-drop-reorder): «сохранил порядок в
 * модалке -> страница отражает новый порядок без ручного reload». Комбинирует
 * `useSalesPlanPage` (владеет `rows`, которые рендерят `SalesPlanTable`/`SalesPlanCardList`) и
 * `useEditPlanForm` (Фаза 2, drag-and-drop + сохранение) в одном `renderHook` на общем
 * `QueryClient` — тот же приём, что `useEmployeeBalancePage.spec.tsx` использует для проверки
 * «созданное через мутацию движение сразу видно в ленте страницы»: мокаем axios-инстанс единым
 * диспетчером по URL вместо мока `model/api.ts`, потому что обе страницы одновременно бьют в
 * несколько разных эндпоинтов.
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const DEPARTMENT_ID = 160
const PERIOD = '2026-09'

function makePlan(category: string, sortOrder: number | null): SalesPerformanceResponse {
    return {
        direction: 'service',
        period: PERIOD,
        department: DEPARTMENT_ID,
        category,
        plan: {
            id: `plan-${category}`,
            direction: 'service',
            department: DEPARTMENT_ID,
            category,
            period: PERIOD,
            turnover: 100000,
            margin: 20000,
            orderTypeIds: [],
            source: 'MANUAL',
            status: 'CREATED',
            approvedBy: null,
            approvedAt: null,
            sortOrder,
            createdAt: new Date('2026-09-01'),
            updatedAt: new Date('2026-09-01'),
        },
        fact: { turnover: 0, margin: 0, marginPercent: 0, cost: 0, quantity: 0, averageCheck: 0, percentCompletion: 0 },
        prognose: { turnover: 0, margin: 0, marginPercent: 0, quantity: 0, percentCompletion: 0 },
    }
}

/**
 * Мини-фейковый бэкенд плана продаж: `store` — карта `category -> sortOrder`, `getPerformance`
 * отдаёт строки, отсортированные ровно так, как это делает бэкенд Фазы 1
 * (`orderSalesPlansByTemplate` — по возрастанию `sortOrder`, `null` в конце) — заказ PATCH
 * (`patchOrder`) правит именно эту карту, а не переставляет готовый массив строк напрямую,
 * чтобы тест был честной проверкой «сервер отдаёт новый порядок при следующем GET», а не подменой
 * ответа вручную.
 */
function buildFakeBackend(initialOrder: string[]) {
    const sortOrderByCategory = new Map(initialOrder.map((category, index) => [category, index]))

    function getPerformance(): SalesPerformanceResponse[] {
        return [...sortOrderByCategory.entries()]
            .sort(([, a], [, b]) => {
                if (a === null) return 1
                if (b === null) return -1
                return a - b
            })
            .map(([category, sortOrder]) => makePlan(category, sortOrder))
    }

    function patchOrder(payload: UpdateSalesPlanOrderRequest): SalesPlanTemplateResponse[] {
        return payload.items.map((item) => {
            sortOrderByCategory.set(item.category ?? '', item.sortOrder)
            return {
                id: `template-${item.category}`,
                direction: 'service',
                department: payload.department,
                category: item.category ?? null,
                turnover: 0,
                margin: 0,
                orderTypeIds: [],
                growthPercent: 0,
                sortOrder: item.sortOrder,
                createdAt: new Date('2026-09-01'),
                updatedAt: new Date('2026-09-01'),
            }
        })
    }

    return { getPerformance, patchOrder }
}

function renderCombined() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    function wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                <MemoryRouter>{children}</MemoryRouter>
            </QueryClientProvider>
        )
    }
    const onOpenChange = vi.fn()
    const utils = renderHook(
        ({ open }: { open: boolean }) => {
            const page = useSalesPlanPage()
            const form = useEditPlanForm({ open, onOpenChange, direction: page.direction, rows: page.editRows })
            return { page, form }
        },
        { wrapper, initialProps: { open: false } },
    )
    return { ...utils, onOpenChange, queryClient }
}

describe('useSalesPlanPage + useEditPlanForm — сохранённый в модалке порядок отражается на странице без reload (Фаза 3, docs/sales-plan-row-drag-and-drop-reorder)', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset()
        vi.mocked(axiosInstance.patch).mockReset()
    })

    it('после handleSave() с изменённым порядком useSalesPlanPage().rows отражает новый порядок сам, без ручного рефетча', async () => {
        const backend = buildFakeBackend(['cat-a', 'cat-b', 'cat-c'])

        vi.mocked(axiosInstance.get).mockImplementation((url: string) => {
            if (url.startsWith('/v1/service/sales/salesPerformance/')) {
                return Promise.resolve({ data: backend.getPerformance() })
            }
            if (url.startsWith('/v1/service/reports/service-categories')) return Promise.resolve({ data: [] })
            if (url.startsWith('/v1/service/reports/order-type')) return Promise.resolve({ data: [] })
            if (url.startsWith('/v1/service/accounting/period/')) {
                const status: AccountingPeriodResponse = {
                    direction: 'service',
                    period: PERIOD,
                    status: 'OPEN',
                    closedBy: null,
                    closedAt: null,
                }
                return Promise.resolve({ data: status })
            }
            if (url.startsWith('/v1/directory/departments')) return Promise.resolve({ data: [] })
            if (url.startsWith('/v1/directory/employees')) return Promise.resolve({ data: [] })
            return Promise.reject(new Error(`Unexpected GET ${url}`))
        })
        vi.mocked(axiosInstance.patch).mockImplementation((url: string, payload?: unknown) => {
            if (url === '/v1/service/sales/plan/order') {
                return Promise.resolve({ data: backend.patchOrder(payload as UpdateSalesPlanOrderRequest) })
            }
            return Promise.reject(new Error(`Unexpected PATCH ${url}`))
        })

        const { result, rerender, onOpenChange } = renderCombined()

        await waitFor(() => expect(result.current.page.rows).toHaveLength(3))
        expect(result.current.page.rows.map((row) => row.category)).toEqual(['cat-a', 'cat-b', 'cat-c'])

        // Открываем модалку (та же closed -> open транзиция, которую `EditPlanModal` делает в
        // реальном приложении) — `useEditPlanForm` подхватывает текущий порядок страницы.
        rerender({ open: true })
        await waitFor(() => expect(result.current.form.rowViews).toHaveLength(3))

        // Перетаскиваем последнюю строку в начало.
        act(() => result.current.form.onReorder('plan-cat-c', 'plan-cat-a'))
        expect(result.current.form.rowViews.map((v) => v.row.category)).toEqual(['cat-c', 'cat-a', 'cat-b'])

        await act(async () => {
            await result.current.form.handleSave()
        })

        // `useUpdateSalesPlanOrder`'s onSuccess инвалидирует `['sales-plan', 'sales-performance',
        // 'service']` — тот же префикс ключа, что и `useSalesPlan`'s `getSalesPerformance` запрос,
        // поэтому страница должна сама подхватить новый порядок при следующем автоматическом
        // рефетче, без явного вызова invalidate/refetch из теста.
        await waitFor(() =>
            expect(result.current.page.rows.map((row) => row.category)).toEqual(['cat-c', 'cat-a', 'cat-b']),
        )

        // Модалка закрылась по успешному сохранению (обычный flow), но порядок на странице уже
        // обновлён и без этого — сама проверка выше не зависела от закрытия модалки.
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })
})
