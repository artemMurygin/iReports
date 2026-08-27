import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ErpCashConfigResponse } from 'ireports-contracts'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { HARDCODED_CREATED_BY } from '../model/api.ts'
import { NewTransactionDrawer, type NewTransactionDrawerProps } from './NewTransactionDrawer.tsx'

// Мокаем сам axios-инстанс (не пакет `axios` целиком — `isAxiosError`, используемый
// `readPayoutConfirmationRequired`/`readPayoutErrorMessage`, должен остаться настоящим, чтобы
// корректно распознавать сконструированные ниже axios-подобные ошибки по `isAxiosError: true`).
vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
    },
}))

const ERP_CASH_CONFIG: ErpCashConfigResponse = {
    direction: 'service',
    roappCashboxId: 1,
    roappCategoryId: 1,
    moySkladExpenseItemId: null,
    moySkladIncomeItemId: null,
    organizationId: null,
    updatedAt: null,
}

function renderDrawer(overrides: Partial<NewTransactionDrawerProps> = {}) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    const onOpenChange = vi.fn()
    render(
        <QueryClientProvider client={queryClient}>
            <NewTransactionDrawer
                open
                onOpenChange={onOpenChange}
                employeeId={42}
                initialKind="outcome"
                currentBalance={5000}
                {...overrides}
            />
        </QueryClientProvider>,
    )
    return { onOpenChange }
}

/**
 * Фаза 6 docs/employee-settlements-page-redesign: тип «Выплата» в единой точке входа
 * «Добавить расход» (`NewTransactionDrawer`) вызывает реальный `create-payout`
 * (`POST /v1/service/accounting/payout`), а не общий `POST .../transactions` — включая
 * ветку подтверждения отрицательного остатка (клиентскую и серверную, 409
 * `PayoutConfirmationRequired`). «Выплата» — первый пункт `OUTCOME_TRANSACTION_TYPES`
 * (см. WHY в `manualTransactionTypes.ts`), поэтому drawer, открытый с `initialKind="outcome"`,
 * по умолчанию уже в режиме выплаты — тесты ниже не трогают Select «Тип» (взаимодействие с
 * Radix `Select` в jsdom требует полифиллов, которых в этом проекте пока нет нигде — см.
 * WHY в `pages/EmployeeBalance/ui/BalanceFilters.spec.tsx` про другие Radix-примитивы).
 */
describe('NewTransactionDrawer — тип «Выплата»', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.get).mockReset().mockResolvedValue({ data: ERP_CASH_CONFIG })
        vi.mocked(axiosInstance.post).mockReset()
        vi.mocked(axiosInstance.delete).mockReset()
    })

    it('defaults the outcome drawer to «Выплата» with the amount prefilled to the current balance', () => {
        renderDrawer({ currentBalance: 5000 })
        expect(screen.getByRole('button', { name: /Выплатить/ })).toBeInTheDocument()
        expect(screen.getByLabelText('Сумма')).toHaveValue(5000)
    })

    it('creates a payout via POST .../payout on submit and closes the drawer on success', async () => {
        const user = userEvent.setup()
        vi.mocked(axiosInstance.post).mockResolvedValueOnce({
            data: { transaction: { id: 'tx-1' }, erpDocument: { id: 'doc-1' } },
        })

        const { onOpenChange } = renderDrawer({ employeeId: 42, currentBalance: 5000 })
        await user.click(screen.getByRole('button', { name: /Выплатить/ }))

        await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledTimes(1))
        const [url, body] = vi.mocked(axiosInstance.post).mock.calls[0]
        expect(url).toBe('/v1/service/accounting/payout')
        expect(body).toMatchObject({
            employeeId: 42,
            amount: 5000,
            createdBy: HARDCODED_CREATED_BY,
            confirmNegativeBalance: undefined,
        })
        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    })

    it('requires the negative-balance confirmation checkbox before submitting when the balance is already ≤ 0', async () => {
        const user = userEvent.setup()
        vi.mocked(axiosInstance.post).mockResolvedValueOnce({
            data: { transaction: { id: 'tx-1' }, erpDocument: { id: 'doc-1' } },
        })

        renderDrawer({ currentBalance: -2000 })

        // Остаток уже отрицательный — сумму приходится ввести вручную (нет дефолтного
        // предзаполнения на отрицательный остаток, см. `defaultAmountFor`).
        await user.type(screen.getByLabelText('Сумма'), '1000')

        expect(screen.getByText(/Подтверждаю выплату сверх остатка/)).toBeInTheDocument()
        const submitButton = screen.getByRole('button', { name: /Выплатить/ })
        expect(submitButton).toBeDisabled()

        await user.click(screen.getByRole('checkbox', { name: 'Подтверждаю выплату сверх остатка' }))
        expect(submitButton).not.toBeDisabled()

        await user.click(submitButton)
        await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledTimes(1))
        const [, body] = vi.mocked(axiosInstance.post).mock.calls[0]
        expect(body).toMatchObject({ amount: 1000, confirmNegativeBalance: true })
    })

    it('shows the server 409 PayoutConfirmationRequired as the same warning, then retries with confirmNegativeBalance on confirm', async () => {
        const user = userEvent.setup()
        vi.mocked(axiosInstance.post)
            .mockRejectedValueOnce({
                isAxiosError: true,
                response: {
                    status: 409,
                    data: { metadata: { employeeId: 42, balance: 3000, balanceAfter: -2000 } },
                },
            })
            .mockResolvedValueOnce({ data: { transaction: { id: 'tx-1' }, erpDocument: { id: 'doc-1' } } })

        const { onOpenChange } = renderDrawer({ currentBalance: 5000 })

        // Клиент не увидел проблему заранее (баланс на экране был положительным) — сервер
        // ответил 409, потому что остаток успел измениться.
        await user.click(screen.getByRole('button', { name: /Выплатить/ }))
        await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledTimes(1))

        expect(await screen.findByText(/Подтверждаю выплату сверх остатка/)).toBeInTheDocument()
        expect(screen.getByText(/Остаток .*— после выплаты будет/)).toBeInTheDocument()

        await user.click(screen.getByRole('checkbox', { name: 'Подтверждаю выплату сверх остатка' }))
        await user.click(screen.getByRole('button', { name: /Выплатить/ }))

        await waitFor(() => expect(axiosInstance.post).toHaveBeenCalledTimes(2))
        const [, secondBody] = vi.mocked(axiosInstance.post).mock.calls[1]
        expect(secondBody).toMatchObject({ confirmNegativeBalance: true })
        await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    })
})
