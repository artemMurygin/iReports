import { queryOptions } from '@tanstack/react-query'
import type { SalaryAccrualListResponse, SalaryAccrualResponse, SalesDirection } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/**
 * Документы начисления зарплаты (Фаза 5 docs/payroll-closing-and-accrual, PRD 1):
 * список за период и карточка документа — чтение (мутации accrue/adjust — Фаза 9).
 * Эндпоинты `service` и `shop` — независимые пары под своими префиксами (см.
 * ENDPOINTS.md, «Начисления зарплаты»), поэтому каждый метод принимает `direction`
 * и собирает путь через `basePath` — тот же приём, что features/AccountingPeriod.
 */

/** Общий префикс ключей фичи — Фаза 9 будет инвалидировать им и список, и карточку
 * после мутаций accrue/unaccrue/adjust. */
export const SALARY_ACCRUALS_QUERY_KEY_PREFIX = ['salary-accruals'] as const

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
}
