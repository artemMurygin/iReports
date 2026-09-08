import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { BalanceTransaction, CreateBalanceTransactionRequest } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'
import { useCreateTransaction } from '@/features/EmployeeBalance'

import { useEmployeeBalancePage } from './useEmployeeBalancePage.ts'

/**
 * Мокаем сам axios-инстанс (тот же приём, что `NewTransactionDrawer.spec.tsx`), а не отдельные
 * модули `model/api.ts` — страница `useEmployeeBalancePage` бьёт сразу в пять разных эндпоинтов
 * (лента баланса, сотрудники/отделы Bitrix, связи с ERP, сводка взаиморасчётов), поэтому нужен
 * единый диспетчер по URL, а не набор моков по одному на файл.
 */
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

function makeTransaction(
    id: string,
    occurredAt: string,
    overrides: Partial<BalanceTransaction> = {},
): BalanceTransaction {
    return {
        id,
        employeeId: 42,
        direction: 'service',
        type: 'BONUS',
        amount: 1000,
        occurredAt: new Date(occurredAt),
        createdAt: new Date(occurredAt),
        createdBy: 1,
        comment: null,
        period: null,
        accrualId: null,
        lineId: null,
        ruleId: null,
        erpSyncRequired: false,
        erp: null,
        ...overrides,
    }
}

/**
 * Мини-фейковый бэкенд ленты баланса (docs/employee-settlements-page-redesign, Фаза 7/8):
 * `store` — движения, УЖЕ отсортированные от новых к старым (тот же инвариант, что
 * `compareBalanceTransactionsDesc` на реальном бэкенде гарантирует после Фазы 7), `get`
 * реализует курсорную пагинацию (`cursor`/`limit`) поверх него, `post` создаёт новое движение и
 * кладёт его В НАЧАЛО (`unshift`) — воспроизводит тот самый инвариант «новое движение — первое
 * в ленте», который Фаза 7 чинила на бэкенде и который эта фаза обязана не сломать на фронтенде
 * (см. WHY у `useInvalidateEmployeeBalanceData`, `features/EmployeeBalance/model/
 * useEmployeeBalanceMutations.ts`).
 */
function buildFakeLedger(initial: BalanceTransaction[]) {
    const store = [...initial]

    function page(cursor: string | null, limit: number) {
        const startIndex = cursor === null ? 0 : store.findIndex((t) => t.id === cursor) + 1
        const slice = store.slice(startIndex, startIndex + limit)
        const hasMore = startIndex + limit < store.length
        const total = store.reduce((sum, t) => sum + t.amount, 0)
        return {
            employeeId: 42,
            balance: total,
            selectionTotal: total,
            transactions: slice,
            nextCursor: hasMore ? (slice[slice.length - 1]?.id ?? null) : null,
            hasMore,
        }
    }

    let createdCount = 0

    return {
        store,
        get(url: string) {
            if (url.startsWith('/v1/directory/employees')) return Promise.resolve({ data: [] })
            if (url.startsWith('/v1/directory/departments')) return Promise.resolve({ data: [] })
            if (url.startsWith('/v1/employee-identity/employee/')) return Promise.resolve({ data: [] })
            if (url.startsWith('/v1/accounting/balance/summary/')) {
                return Promise.resolve({
                    data: {
                        period: '2026-06',
                        departmentId: null,
                        employees: [],
                        totals: { balance: 0, toPay: { amount: 0, count: 0 }, debt: { amount: 0, count: 0 } },
                    },
                })
            }
            if (url.startsWith('/v1/accounting/balance/employee/')) {
                const parsed = new URL(url, 'http://localhost')
                const cursor = parsed.searchParams.get('cursor')
                const limit = Number(parsed.searchParams.get('limit') ?? '20')
                return Promise.resolve({ data: page(cursor, limit) })
            }
            return Promise.reject(new Error(`Unexpected GET ${url}`))
        },
        post(_url: string, payload: CreateBalanceTransactionRequest) {
            createdCount += 1
            const tx = makeTransaction(`tx-new-${createdCount}`, new Date().toISOString(), {
                direction: payload.direction,
                type: payload.type as BalanceTransaction['type'],
                amount: payload.amount,
                comment: payload.comment ?? null,
                createdBy: payload.createdBy,
            })
            store.unshift(tx)
            return Promise.resolve({ data: tx })
        },
    }
}

function renderPage(employeeId: number) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    function wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[`/balance/employee/${employeeId}`]}>
                    <Routes>
                        <Route path="/balance/employee/:id" element={<>{children}</>} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )
    }
    return { wrapper, queryClient }
}

describe('useEmployeeBalancePage — «за всё время» и курсорная пагинация (Фаза 8)', () => {
    // 25 движений (> 20, размер одной страницы) — tx-25 самое новое, tx-1 самое старое.
    const fixture = Array.from({ length: 25 }, (_, index) => {
        const n = 25 - index
        return makeTransaction(`tx-${n}`, `2026-08-${String(n).padStart(2, '0')}T00:00:00.000Z`)
    })

    beforeEach(() => {
        const ledger = buildFakeLedger(fixture)
        vi.mocked(axiosInstance.get)
            .mockReset()
            .mockImplementation((url: string) => ledger.get(url))
        vi.mocked(axiosInstance.post).mockReset()
        vi.mocked(axiosInstance.delete).mockReset()
    })

    it('shows at most 20 transactions on the initial page, newest first', async () => {
        const { wrapper } = renderPage(42)
        const { result } = renderHook(() => useEmployeeBalancePage(), { wrapper })

        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))

        expect(result.current.transactions).toHaveLength(20)
        expect(result.current.transactions[0].id).toBe('tx-25')
        expect(result.current.transactions[19].id).toBe('tx-6')
        expect(result.current.hasNextPage).toBe(true)
    })

    it('does not send from/to query params by default ("за всё время")', async () => {
        const { wrapper } = renderPage(42)
        const { result } = renderHook(() => useEmployeeBalancePage(), { wrapper })
        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))

        const ledgerCalls = vi
            .mocked(axiosInstance.get)
            .mock.calls.map(([url]) => url as string)
            .filter((url) => url.startsWith('/v1/accounting/balance/employee/'))
        expect(ledgerCalls.length).toBeGreaterThan(0)
        for (const url of ledgerCalls) {
            expect(url).not.toMatch(/[?&]from=/)
            expect(url).not.toMatch(/[?&]to=/)
        }
    })

    it('loads and appends the next 20 (remaining 5) transactions on loadMoreTransactions()', async () => {
        const { wrapper } = renderPage(42)
        const { result } = renderHook(() => useEmployeeBalancePage(), { wrapper })
        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))
        expect(result.current.transactions).toHaveLength(20)

        act(() => {
            result.current.loadMoreTransactions()
        })

        await waitFor(() => expect(result.current.transactions).toHaveLength(25))
        expect(result.current.transactions[20].id).toBe('tx-5')
        expect(result.current.transactions[24].id).toBe('tx-1')
        expect(result.current.hasNextPage).toBe(false)
    })

    it('does not request a next page once hasNextPage is false', async () => {
        const { wrapper } = renderPage(42)
        const { result } = renderHook(() => useEmployeeBalancePage(), { wrapper })
        await waitFor(() => expect(result.current.isInitialLoad).toBe(false))
        act(() => result.current.loadMoreTransactions())
        await waitFor(() => expect(result.current.hasNextPage).toBe(false))

        const callsBefore = vi.mocked(axiosInstance.get).mock.calls.length
        act(() => result.current.loadMoreTransactions())
        expect(vi.mocked(axiosInstance.get).mock.calls.length).toBe(callsBefore)
    })
})

describe('useEmployeeBalancePage — новое движение оказывается первым в ленте (Фаза 8, регресс на баг сортировки Фазы 7)', () => {
    const fixture = [
        makeTransaction('tx-3', '2026-08-03T00:00:00.000Z'),
        makeTransaction('tx-2', '2026-08-02T00:00:00.000Z'),
        makeTransaction('tx-1', '2026-08-01T00:00:00.000Z'),
    ]

    beforeEach(() => {
        const ledger = buildFakeLedger(fixture)
        vi.mocked(axiosInstance.get)
            .mockReset()
            .mockImplementation((url: string) => ledger.get(url))
        vi.mocked(axiosInstance.post)
            .mockReset()
            .mockImplementation((url: string, payload?: unknown) =>
                ledger.post(url, payload as CreateBalanceTransactionRequest),
            )
        vi.mocked(axiosInstance.delete).mockReset()
    })

    it('renders the transaction created via useCreateTransaction first after the mutation succeeds', async () => {
        const { wrapper } = renderPage(42)
        const { result } = renderHook(
            () => ({
                page: useEmployeeBalancePage(),
                createTransaction: useCreateTransaction(42),
            }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.page.isInitialLoad).toBe(false))
        expect(result.current.page.transactions[0].id).toBe('tx-3')
        expect(result.current.page.transactions).toHaveLength(3)

        await act(async () => {
            await result.current.createTransaction.mutateAsync({
                direction: 'service',
                type: 'BONUS',
                amount: 5000,
                createdBy: 1,
            })
        })

        // Инвалидация (`useInvalidateEmployeeBalanceData`) обязана перезапросить ленту С ПЕРВОЙ
        // страницы (курсор undefined), а не только уже загруженные страницы «на месте» — иначе
        // свежесозданное движение осталось бы висеть на бэкенде первым, но не попало бы в уже
        // закэшированный на фронтенде массив до следующего полного релоада страницы.
        await waitFor(() => expect(result.current.page.transactions[0].id).toBe('tx-new-1'))
        expect(result.current.page.transactions).toHaveLength(4)
        expect(result.current.page.transactions[1].id).toBe('tx-3')
    })
})
