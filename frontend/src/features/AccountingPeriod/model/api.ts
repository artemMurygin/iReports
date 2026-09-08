import { queryOptions } from '@tanstack/react-query'
import type { AccountingPeriodResponse, ClosePeriodPreviewResponse, SalesDirection } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/**
 * Данные расчётного периода (Фаза 4 docs/payroll-closing-and-accrual, PRD 1):
 * статус периода, сводка окна подтверждения закрытия и мутации close/reopen.
 * Эндпоинты `service` и `shop` — независимые пары под своими префиксами
 * (см. ENDPOINTS.md, «Расчётный период»), поэтому каждый метод принимает
 * `direction` и собирает путь через `basePath`, как `useApproveSalesPlanRows`.
 */

/** Общий префикс ключей фичи — им инвалидируются и статус периода, и close-preview
 * (после закрытия/переоткрытия/утверждения строк плана из диалога закрытия). */
export const ACCOUNTING_PERIOD_QUERY_KEY_PREFIX = ['accounting-period'] as const

/** Bitrix24 id руководителя в `closedBy` — то же захардкоженное значение и по той же
 * причине, что `HARDCODED_APPROVED_BY` в features/SalesPlan/model/useApproveSalesPlanRows.ts:
 * модели «текущего пользователя» на фронтенде нет, бэкенд принимает id полем тела запроса. */
export const HARDCODED_CLOSED_BY = 1

function basePath(direction: SalesDirection): string {
    return direction === 'shop' ? '/v1/shop/accounting' : '/v1/service/accounting'
}

export const api = {
    // GET /v1/{direction}/accounting/period/:period — статус периода; для месяца без
    // записи в БД бэкенд сам отдаёт `status: 'OPEN'`, отдельного «нет данных» нет.
    getPeriod: (direction: SalesDirection, period: string) =>
        queryOptions({
            queryKey: [...ACCOUNTING_PERIOD_QUERY_KEY_PREFIX, 'status', direction, period],
            queryFn: ({ signal }): Promise<AccountingPeriodResponse> =>
                apiInstance
                    .get<AccountingPeriodResponse>(`${basePath(direction)}/period/${period}`, { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить статус расчётного периода ' + error)
                    }),
        }),

    // GET .../period/:period/close-preview — контрольные цифры окна подтверждения
    // (ClosePeriodPreviewResponse). staleTime 0 + refetchOnMount: сводка обязана быть
    // свежей на каждое открытие диалога — по ней руководитель решает, закрывать ли месяц.
    getClosePreview: (direction: SalesDirection, period: string) =>
        queryOptions({
            queryKey: [...ACCOUNTING_PERIOD_QUERY_KEY_PREFIX, 'close-preview', direction, period],
            staleTime: 0,
            queryFn: ({ signal }): Promise<ClosePeriodPreviewResponse> =>
                apiInstance
                    .get<ClosePeriodPreviewResponse>(`${basePath(direction)}/period/${period}/close-preview`, {
                        signal,
                    })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить сводку закрытия месяца ' + error)
                    }),
        }),

    // POST .../period/:period/close — закрыть месяц. Ошибка НЕ оборачивается в ApiError:
    // диалогу закрытия нужен исходный AxiosError с телом ответа (`metadata.rows`,
    // текст ошибки ERP-синка, `closedBy`/`closedAt`), классификацию делает
    // model/closePeriodErrors.ts (см. приём с unapprovedSalesPlanRowSchema в контрактах).
    closePeriod: (direction: SalesDirection, period: string): Promise<AccountingPeriodResponse> =>
        apiInstance
            .post<AccountingPeriodResponse>(`${basePath(direction)}/period/${period}/close`, {
                closedBy: HARDCODED_CLOSED_BY,
            })
            .then((r) => r.data),

    // POST .../period/:period/reopen — переоткрыть закрытый месяц ({ confirm: true }).
    // Ошибка тоже сырая: 409 несёт `metadata.accruals` (документы не в DRAFT).
    reopenPeriod: (direction: SalesDirection, period: string): Promise<AccountingPeriodResponse> =>
        apiInstance
            .post<AccountingPeriodResponse>(`${basePath(direction)}/period/${period}/reopen`, { confirm: true })
            .then((r) => r.data),
}
