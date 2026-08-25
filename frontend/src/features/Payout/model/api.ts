import { queryOptions } from '@tanstack/react-query'
import type {
    CreatePayoutRequest,
    ErpCashConfigResponse,
    PayoutBatchRequest,
    PayoutBatchResponse,
    PayoutPageResponse,
    PayoutResponse,
    SalesDirection,
} from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/**
 * Выплата зарплаты (Фаза 14 docs/payroll-closing-and-accrual, PRD 3): таблица сотрудников
 * периода, создание выплаты (одиночная/пакетная) и конфигурация кассы ERP направления —
 * подпись «Касса: RemOnline · Основная» / «МойСклад · статья «Зарплата»» в шапке страницы
 * (P3.1). Эндпоинты — per-direction под `/v1/{direction}/accounting/payout*` и
 * `/v1/{direction}/accounting/erp_cash_config` (см. `routesV1.service/shop.accounting.payout`,
 * `app.routes.ts`), тот же приём `basePath(direction)`, что `features/SalaryAccruals/model/api.ts`.
 */

export const PAYOUT_QUERY_KEY_PREFIX = ['payout'] as const
export const ERP_CASH_CONFIG_QUERY_KEY_PREFIX = ['erp-cash-config'] as const

/** Bitrix24 id руководителя в createdBy выплаты — тот же захардкоженный приём и по той же
 * причине, что HARDCODED_CREATED_BY в features/EmployeeBalance/model/api.ts: модели «текущего
 * пользователя» на фронтенде нет. Задублирован здесь намеренно — кросс-импорт между features
 * запрещён FSD. */
export const HARDCODED_CREATED_BY = 1

function basePath(direction: SalesDirection): string {
    return direction === 'shop' ? '/v1/shop/accounting' : '/v1/service/accounting'
}

export const api = {
    // GET /v1/{direction}/accounting/payout/:period — таблица сотрудников направления за
    // месяц: начислено/авансы/ручные/остаток/выплачено/payoutStatus + итоги.
    getPayoutPage: (direction: SalesDirection, period: string) =>
        queryOptions({
            queryKey: [...PAYOUT_QUERY_KEY_PREFIX, direction, period],
            queryFn: ({ signal }): Promise<PayoutPageResponse> =>
                apiInstance
                    .get<PayoutPageResponse>(`${basePath(direction)}/payout/${period}`, { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить страницу выплаты ' + error)
                    }),
        }),

    // GET .../erp_cash_config — подпись кассы/статьи в шапке (read-only, без выбора, P3.1).
    // null-поля означают «направление ещё не сконфигурировано» — страница показывает это как
    // «Касса не настроена», а не падает.
    getErpCashConfig: (direction: SalesDirection) =>
        queryOptions({
            queryKey: [...ERP_CASH_CONFIG_QUERY_KEY_PREFIX, direction],
            queryFn: ({ signal }): Promise<ErpCashConfigResponse> =>
                apiInstance
                    .get<ErpCashConfigResponse>(`${basePath(direction)}/erp_cash_config`, { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить конфигурацию кассы ' + error)
                    }),
        }),

    // POST .../payout — выплата одному сотруднику. Ошибка НЕ оборачивается в ApiError (см.
    // EmployeeBalance/model/api.ts) — UI мутации читает сырой AxiosError: 409 несёт
    // `PayoutConfirmationRequired` в `error.response.data.metadata`.
    createPayout: (direction: SalesDirection, payload: CreatePayoutRequest): Promise<PayoutResponse> =>
        apiInstance.post<PayoutResponse>(`${basePath(direction)}/payout`, payload).then((r) => r.data),

    // POST .../payout/batch — выплата по каждому сотруднику на его серверный остаток;
    // 200 всегда (список исходов, не ошибка целиком), кроме случаев сетевого/5xx-сбоя.
    createPayoutBatch: (direction: SalesDirection, payload: PayoutBatchRequest): Promise<PayoutBatchResponse> =>
        apiInstance.post<PayoutBatchResponse>(`${basePath(direction)}/payout/batch`, payload).then((r) => r.data),

    // DELETE .../payout/:id — удалить выплату (id — BalanceTransaction.id движения PAYOUT):
    // ERP delete → транзакция (удаление движения + возврат затронутых документов начисления из
    // PAID в ACCRUED); отказ ERP → ничего не изменилось (Фаза 15 docs/payroll-closing-and-accrual,
    // P3.3). Без тела, 204; ошибка НЕ оборачивается в ApiError — тот же приём, что createPayout.
    deletePayout: (direction: SalesDirection, transactionId: string): Promise<void> =>
        apiInstance.delete<void>(`${basePath(direction)}/payout/${transactionId}`).then((r) => r.data),
}
