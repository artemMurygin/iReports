import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { SalesPlanResponse, SalesPlanTemplateResponse, UpdateSalesPlanOrderRequest } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'
import type { SalesPlanRow } from '@/features/SalesPlan/model/useSalesPlan.ts'

import { useEditPlanForm } from './useEditPlanForm.ts'

/**
 * Мокаем сам axios-инстанс (тот же приём, что `useEmployeeBalancePage.spec.tsx`) — один
 * диспетчер по методу/URL вместо мока `model/api.ts`, потому что `handleSave` бьёт сразу в два
 * разных эндпоинта (батч правки строк `PATCH .../plan/:id` и батч порядка `PATCH .../plan/order`,
 * см. Фазу 1 docs/sales-plan-row-drag-and-drop-reorder) одним действием пользователя.
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), patch: vi.fn() },
}))

// `useEditPlanForm` вызывает `toast.success`/`toast.error` напрямую (см. её собственный
// комментарий про "существующий паттерн ошибок этой модалки") — мокаем `sonner`, чтобы
// проверять сообщения без монтирования настоящего `<Toaster/>`.
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { toast } from 'sonner'

function makeRow(overrides: Partial<SalesPlanRow['plan']> & { category: string | null; id: string }): SalesPlanRow {
    const plan: SalesPlanResponse = {
        id: overrides.id,
        direction: 'service',
        department: 160,
        category: overrides.category,
        period: '2026-09',
        turnover: overrides.turnover ?? 100000,
        margin: overrides.margin ?? 20000,
        orderTypeIds: overrides.orderTypeIds ?? [],
        source: 'MANUAL',
        status: 'CREATED',
        approvedBy: null,
        approvedAt: null,
        sortOrder: overrides.sortOrder ?? null,
        createdAt: new Date('2026-09-01'),
        updatedAt: new Date('2026-09-01'),
    }
    return {
        direction: 'service',
        period: '2026-09',
        department: 160,
        category: overrides.category,
        plan,
        fact: { turnover: 0, margin: 0, marginPercent: 0, cost: 0, quantity: 0, averageCheck: 0, percentCompletion: 0 },
        prognose: { turnover: 0, margin: 0, marginPercent: 0, quantity: 0, percentCompletion: 0 },
        categoryName: overrides.category ?? 'Все направление',
        remaining: plan.turnover,
        remainingMargin: plan.margin,
        marginPercent: 0,
        orderTypeNames: [],
    }
}

/**
 * Mounts closed, then opens — same as the real `EditPlanModal`, whose `open` prop starts `false`
 * (`useSalesPlanPage`'s `isEditModalOpen`) and only becomes `true` once the user clicks "Изменить
 * план". `useEditPlanForm` seeds `values`/`orderedIds` on the closed -> open transition (see its
 * own doc comment); mounting already-`open` would skip that transition and start from an
 * unseeded state, which the hook never has to handle in the real app.
 */
function renderForm(rows: SalesPlanRow[]) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    function wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    const onOpenChange = vi.fn()
    const utils = renderHook(
        ({ open, rows: currentRows }: { open: boolean; rows: SalesPlanRow[] }) =>
            useEditPlanForm({ open, onOpenChange, direction: 'service', rows: currentRows }),
        { wrapper, initialProps: { open: false, rows } },
    )
    act(() => utils.rerender({ open: true, rows }))
    return { ...utils, onOpenChange, queryClient }
}

describe('useEditPlanForm — drag-and-drop order (Фаза 2, docs/sales-plan-row-drag-and-drop-reorder)', () => {
    const rowA = makeRow({ id: 'plan-a', category: 'cat-a' })
    const rowB = makeRow({ id: 'plan-b', category: 'cat-b' })
    const rowC = makeRow({ id: 'plan-c', category: 'cat-c' })

    beforeEach(() => {
        vi.mocked(axiosInstance.get)
            .mockReset()
            .mockImplementation((url: string) => {
                if (url.startsWith('/v1/service/reports/order-type')) return Promise.resolve({ data: [] })
                return Promise.reject(new Error(`Unexpected GET ${url}`))
            })
        vi.mocked(axiosInstance.patch).mockReset()
        vi.mocked(toast.success).mockReset()
        vi.mocked(toast.error).mockReset()
    })

    it('reorders rowViews locally on onReorder — no network call', async () => {
        const { result } = renderForm([rowA, rowB, rowC])
        await waitFor(() => expect(result.current.rowViews).toHaveLength(3))
        expect(result.current.rowViews.map((v) => v.row.plan.id)).toEqual(['plan-a', 'plan-b', 'plan-c'])

        act(() => {
            // Drags the last row ("plan-c") into the first position — same call shape
            // `EditPlanTable`'s `handleDragEnd` makes from a real dnd-kit `DragEndEvent`.
            result.current.onReorder('plan-c', 'plan-a')
        })

        expect(result.current.rowViews.map((v) => v.row.plan.id)).toEqual(['plan-c', 'plan-a', 'plan-b'])
        expect(axiosInstance.patch).not.toHaveBeenCalled()
    })

    it('is a no-op when dragging a row onto itself', () => {
        const { result } = renderForm([rowA, rowB])
        act(() => result.current.onReorder('plan-a', 'plan-a'))
        expect(result.current.rowViews.map((v) => v.row.plan.id)).toEqual(['plan-a', 'plan-b'])
    })

    it('canSave becomes true from a reorder alone, with no field edits', async () => {
        const { result } = renderForm([rowA, rowB])
        await waitFor(() => expect(result.current.rowViews).toHaveLength(2))
        expect(result.current.canSave).toBe(false)

        act(() => result.current.onReorder('plan-b', 'plan-a'))

        expect(result.current.canSave).toBe(true)
    })

    it('calls only the order endpoint when just the order changed (no field edits)', async () => {
        vi.mocked(axiosInstance.patch).mockResolvedValue({ data: [] as SalesPlanTemplateResponse[] })
        const { result, onOpenChange } = renderForm([rowA, rowB])
        await waitFor(() => expect(result.current.rowViews).toHaveLength(2))

        act(() => result.current.onReorder('plan-b', 'plan-a'))
        await act(async () => {
            await result.current.handleSave()
        })

        expect(axiosInstance.patch).toHaveBeenCalledTimes(1)
        const [url, body] = vi.mocked(axiosInstance.patch).mock.calls[0] as [string, UpdateSalesPlanOrderRequest]
        expect(url).toBe('/v1/service/sales/plan/order')
        expect(body).toEqual({
            department: 160,
            items: [
                { category: 'cat-b', sortOrder: 0 },
                { category: 'cat-a', sortOrder: 1 },
            ],
        })
        expect(onOpenChange).toHaveBeenCalledWith(false)
        expect(toast.success).toHaveBeenCalledWith('Порядок категорий сохранён')
    })

    it('calls both the row-update and order endpoints in one handleSave when both changed', async () => {
        vi.mocked(axiosInstance.patch).mockImplementation((url: string) => {
            if (url === '/v1/service/sales/plan/order') return Promise.resolve({ data: [] })
            return Promise.resolve({ data: { ...rowA.plan, turnover: 150000 } })
        })
        const { result, onOpenChange } = renderForm([rowA, rowB])
        await waitFor(() => expect(result.current.rowViews).toHaveLength(2))

        act(() => {
            result.current.setField('plan-a', 'turnover', '150000')
            result.current.onReorder('plan-b', 'plan-a')
        })

        await act(async () => {
            await result.current.handleSave()
        })

        const calls = vi.mocked(axiosInstance.patch).mock.calls
        expect(calls).toHaveLength(2)
        expect(calls.some(([url]) => url === '/v1/service/sales/plan/plan-a')).toBe(true)
        expect(calls.some(([url]) => url === '/v1/service/sales/plan/order')).toBe(true)
        expect(onOpenChange).toHaveBeenCalledWith(false)
        expect(toast.success).toHaveBeenCalledWith('План категории обновлён, порядок сохранён')
    })

    it('discards the local reorder on cancel — reopening the modal restores the original order', async () => {
        const { result, rerender } = renderForm([rowA, rowB])
        await waitFor(() => expect(result.current.rowViews).toHaveLength(2))

        act(() => result.current.onReorder('plan-b', 'plan-a'))
        expect(result.current.rowViews.map((v) => v.row.plan.id)).toEqual(['plan-b', 'plan-a'])

        act(() => result.current.handleCancel())
        // `handleCancel` only calls `onOpenChange(false)` — the parent owns `open`, so the test
        // drives the close/reopen transition itself via `rerender`, same as the modal would.
        rerender({ open: false, rows: [rowA, rowB] })
        rerender({ open: true, rows: [rowA, rowB] })

        await waitFor(() => expect(result.current.rowViews.map((v) => v.row.plan.id)).toEqual(['plan-a', 'plan-b']))
        expect(axiosInstance.patch).not.toHaveBeenCalled()
    })

    it('on order-save failure: keeps the modal open, shows an error, and preserves the reordered draft', async () => {
        vi.mocked(axiosInstance.patch).mockRejectedValue(new Error('Network down'))
        const { result, onOpenChange } = renderForm([rowA, rowB])
        await waitFor(() => expect(result.current.rowViews).toHaveLength(2))

        act(() => result.current.onReorder('plan-b', 'plan-a'))
        await act(async () => {
            await result.current.handleSave()
        })

        expect(onOpenChange).not.toHaveBeenCalled()
        expect(toast.error).toHaveBeenCalledTimes(1)
        expect(toast.error).toHaveBeenCalledWith(
            'Не удалось сохранить план',
            expect.objectContaining({ description: expect.stringContaining('Порядок:') }),
        )
        // The draft order survives the failed save untouched — still reordered, ready to retry.
        expect(result.current.rowViews.map((v) => v.row.plan.id)).toEqual(['plan-b', 'plan-a'])
        expect(result.current.canSave).toBe(true)
    })

    it('on partial row-update failure alongside a successful order save: keeps the modal open and preserves edits', async () => {
        vi.mocked(axiosInstance.patch).mockImplementation((url: string) => {
            if (url === '/v1/service/sales/plan/order') return Promise.resolve({ data: [] })
            return Promise.reject(new Error('Категория заблокирована'))
        })
        const { result, onOpenChange } = renderForm([rowA, rowB])
        await waitFor(() => expect(result.current.rowViews).toHaveLength(2))

        act(() => {
            result.current.setField('plan-a', 'turnover', '150000')
            result.current.onReorder('plan-b', 'plan-a')
        })

        await act(async () => {
            await result.current.handleSave()
        })

        expect(onOpenChange).not.toHaveBeenCalled()
        expect(toast.error).toHaveBeenCalledTimes(1)
        // The failed field edit is still there for the user to fix/retry.
        expect(result.current.rowViews.find((v) => v.row.plan.id === 'plan-a')?.values.turnover).toBe('150000')
        expect(result.current.rowViews.map((v) => v.row.plan.id)).toEqual(['plan-b', 'plan-a'])
    })
})

describe('useEditPlanForm — canReorder is available for both directions', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset().mockResolvedValue({ data: [] })
        vi.mocked(axiosInstance.patch).mockReset()
    })

    it('exposes canReorder: true for direction "service"', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        function wrapper({ children }: { children: ReactNode }) {
            return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        }
        const { result } = renderHook(
            () => useEditPlanForm({ open: true, onOpenChange: vi.fn(), direction: 'service', rows: [] }),
            { wrapper },
        )
        expect(result.current.canReorder).toBe(true)
    })

    it('exposes canReorder: true for direction "shop" (backend order endpoint shipped in Фаза 4)', () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        function wrapper({ children }: { children: ReactNode }) {
            return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        }
        const { result } = renderHook(
            () => useEditPlanForm({ open: true, onOpenChange: vi.fn(), direction: 'shop', rows: [] }),
            { wrapper },
        )
        expect(result.current.canReorder).toBe(true)
    })

    it('saving a reordered "shop" plan PATCHes /v1/shop/sales/plan/order', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        function wrapper({ children }: { children: ReactNode }) {
            return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        }
        vi.mocked(axiosInstance.patch).mockResolvedValue({ data: [] })
        const rows = [
            makeRow({ id: 'shop-a', category: 'cat-a', sortOrder: 0 }),
            makeRow({ id: 'shop-b', category: 'cat-b', sortOrder: 1 }),
        ].map((row) => ({ ...row, direction: 'shop' as const, plan: { ...row.plan, direction: 'shop' as const } }))
        // Mount closed then open, same as `renderForm` above — `useEditPlanForm` only seeds
        // `orderedIds` on the closed -> open transition, so mounting already-`open` would leave
        // it empty and `onReorder` below would be a no-op (its ids wouldn't be found in `[]`).
        const { result, rerender } = renderHook(
            ({ open }: { open: boolean }) => useEditPlanForm({ open, onOpenChange: vi.fn(), direction: 'shop', rows }),
            { wrapper, initialProps: { open: false } },
        )
        act(() => rerender({ open: true }))
        act(() => result.current.onReorder('shop-b', 'shop-a'))
        await act(async () => {
            await result.current.handleSave()
        })
        expect(axiosInstance.patch).toHaveBeenCalledWith(
            '/v1/shop/sales/plan/order',
            expect.objectContaining({ items: expect.any(Array) }),
        )
    })
})
