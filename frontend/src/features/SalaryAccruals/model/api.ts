import { queryOptions } from '@tanstack/react-query'
import type {
    AccrueSalaryAccrualDocumentResponse,
    AccruePeriodSalaryAccrualsResponse,
    SalaryAccrualListResponse,
    SalaryAccrualResponse,
    SalesDirection,
} from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/**
 * Документы начисления зарплаты (Фаза 5 docs/payroll-closing-and-accrual, PRD 1):
 * список за период и карточка документа — чтение. Действия проведения/отмены/
 * корректировки строки и массовое проведение (Фаза 9, PRD 2) — мутации ниже.
 * Эндпоинты `service` и `shop` — независимые пары под своими префиксами (см.
 * ENDPOINTS.md, «Начисления зарплаты»), поэтому каждый метод принимает `direction`
 * и собирает путь через `basePath` — тот же приём, что features/AccountingPeriod.
 */

/** Общий префикс ключей фичи — инвалидируется им и список, и карточка после мутаций
 * accrue/unaccrue/adjust (см. useAccrualMutations.ts). */
export const SALARY_ACCRUALS_QUERY_KEY_PREFIX = ['salary-accruals'] as const

/** Bitrix24 id руководителя в accruedBy/adjustedBy — тот же захардкоженный приём и по
 * той же причине, что HARDCODED_CLOSED_BY в features/AccountingPeriod/model/api.ts:
 * модели «текущего пользователя» на фронтенде нет. Задублирован здесь намеренно —
 * см. отчёт фичи AccountingPeriod, кросс-импорт между features запрещён FSD. */
export const HARDCODED_ACCRUED_BY = 1

function basePath(direction: SalesDirection): string {
    return direction === 'shop' ? '/v1/shop/accounting' : '/v1/service/accounting'
}

export const api = {
    // GET /v1/{direction}/accounting/salary_accruals?period — список документов за
    // период. До закрытия периода бэкенд отдаёт пустой список (не 404) — состояние
    // «месяц не закрыт» страница различает по статусу AccountingPeriod, а не по этому
    // ответу.
    getAccruals: (direction: SalesDirection, period: string) =>
        queryOptions({
            queryKey: [...SALARY_ACCRUALS_QUERY_KEY_PREFIX, 'list', direction, period],
            queryFn: ({ signal }): Promise<SalaryAccrualListResponse> =>
                apiInstance
                    .get<SalaryAccrualListResponse>(`${basePath(direction)}/salary_accruals`, {
                        params: { period },
                        signal,
                    })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить список начислений ' + error)
                    }),
        }),

    // GET .../salary_accruals/:id — карточка документа со строками по правилам;
    // 404, если документ не найден или принадлежит другому направлению.
    getAccrual: (direction: SalesDirection, id: string) =>
        queryOptions({
            queryKey: [...SALARY_ACCRUALS_QUERY_KEY_PREFIX, 'document', direction, id],
            queryFn: ({ signal }): Promise<SalaryAccrualResponse> =>
                apiInstance
                    .get<SalaryAccrualResponse>(`${basePath(direction)}/salary_accruals/${id}`, { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить документ начисления ' + error)
                    }),
        }),

    // POST .../salary_accruals/:id/lines/:lineId/accrue — провести строку на баланс.
    // Ошибка НЕ оборачивается в ApiError (см. AccountingPeriod/model/api.ts) — UI
    // мутаций читает исходный AxiosError (response.status/response.data), а не
    // человекочитаемое сообщение.
    accrueLine: (direction: SalesDirection, accrualId: string, lineId: string): Promise<SalaryAccrualResponse> =>
        apiInstance
            .post<SalaryAccrualResponse>(`${basePath(direction)}/salary_accruals/${accrualId}/lines/${lineId}/accrue`, {
                accruedBy: HARDCODED_ACCRUED_BY,
            })
            .then((r) => r.data),

    // POST .../salary_accruals/:id/lines/:lineId/unaccrue — отменить начисление строки
    // (без тела). 409, если документ уже PAID — UI разбирает сырую ошибку.
    unaccrueLine: (direction: SalesDirection, accrualId: string, lineId: string): Promise<SalaryAccrualResponse> =>
        apiInstance
            .post<SalaryAccrualResponse>(`${basePath(direction)}/salary_accruals/${accrualId}/lines/${lineId}/unaccrue`)
            .then((r) => r.data),

    // PATCH .../salary_accruals/:id/lines/:lineId — скорректировать сумму строки
    // (только DRAFT, иначе 409; пустой comment -> 400 от бэкенда).
    adjustLine: (
        direction: SalesDirection,
        accrualId: string,
        lineId: string,
        payload: { amount: number; comment: string },
    ): Promise<SalaryAccrualResponse> =>
        apiInstance
            .patch<SalaryAccrualResponse>(`${basePath(direction)}/salary_accruals/${accrualId}/lines/${lineId}`, {
                amount: payload.amount,
                comment: payload.comment,
                adjustedBy: HARDCODED_ACCRUED_BY,
            })
            .then((r) => r.data),

    // POST .../salary_accruals/:id/accrue — начислить весь документ построчно;
    // ответ несёт обновлённую карточку и перечень строк, которые провести не удалось.
    accrueDocument: (direction: SalesDirection, accrualId: string): Promise<AccrueSalaryAccrualDocumentResponse> =>
        apiInstance
            .post<AccrueSalaryAccrualDocumentResponse>(`${basePath(direction)}/salary_accruals/${accrualId}/accrue`, {
                accruedBy: HARDCODED_ACCRUED_BY,
            })
            .then((r) => r.data),

    // POST .../salary_accruals/accrue?period=YYYY-MM — начислить все документы месяца
    // направления; ответ несёт статистику операции и перечень ошибок построчно.
    accruePeriod: (direction: SalesDirection, period: string): Promise<AccruePeriodSalaryAccrualsResponse> =>
        apiInstance
            .post<AccruePeriodSalaryAccrualsResponse>(
                `${basePath(direction)}/salary_accruals/accrue`,
                { accruedBy: HARDCODED_ACCRUED_BY },
                { params: { period } },
            )
            .then((r) => r.data),
}
