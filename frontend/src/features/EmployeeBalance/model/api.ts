import { queryOptions } from '@tanstack/react-query'
import type {
    BalanceTransaction,
    CreateBalanceTransactionRequest,
    DepartmentBalancesResponse,
    EmployeeBalanceResponse,
} from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/**
 * Баланс сотрудника — общий, без деления на направления (Фаза 8b/10
 * docs/payroll-closing-and-accrual): лента движений и остаток сотрудника
 * (`getEmployeeBalance`), сводка по отделу за период (`getDepartmentBalances`)
 * и ручные движения — создание/удаление (Фаза 7). Эндпоинты живут под
 * /v1/accounting/balance, вне /v1/service и /v1/shop (см. ENDPOINTS.md,
 * «Баланс сотрудника») — в отличие от features/SalaryAccruals здесь нет
 * `basePath(direction)`, путь один на оба направления.
 */

/** Ключ ленты/остатка сотрудника — инвалидируется им же после мутаций
 * (создание/удаление ручного движения), см. useEmployeeBalanceMutations.ts. */
export const EMPLOYEE_BALANCE_QUERY_KEY_PREFIX = ['employee-balance'] as const

/** Ключ сводки по отделу — та же лента, но сгруппированная по сотрудникам
 * отдела за период; инвалидируется вместе с EMPLOYEE_BALANCE_QUERY_KEY_PREFIX. */
export const DEPARTMENT_BALANCES_QUERY_KEY_PREFIX = ['department-balances'] as const

/** Bitrix24 id руководителя в createdBy ручного движения — тот же
 * захардкоженный приём и по той же причине, что HARDCODED_ACCRUED_BY в
 * features/SalaryAccruals/model/api.ts: модели «текущего пользователя» на
 * фронтенде нет. Задублирована здесь намеренно — кросс-импорт между
 * features запрещён FSD. */
export const HARDCODED_CREATED_BY = 1

/** GET .../employee/:id?from&to&types — первый прецедент query-параметров
 * from/to/types в проекте: собираются вручную через URLSearchParams (see
 * task), а не через axios `params`, чтобы `types` ушёл строкой через запятую
 * (?types=SALARY_ACCRUAL,ADVANCE), как ожидает бэкенд. */
function buildEmployeeBalanceQuery(filters?: { from?: string; to?: string; types?: string[] }): string {
    const params = new URLSearchParams()
    if (filters?.from !== undefined) params.set('from', filters.from)
    if (filters?.to !== undefined) params.set('to', filters.to)
    if (filters?.types !== undefined && filters.types.length > 0) params.set('types', filters.types.join(','))
    const query = params.toString()
    return query.length > 0 ? `?${query}` : ''
}

export const api = {
    // GET /v1/accounting/balance/employee/:id?from&to&types — остаток (не
    // зависит от фильтров) и лента движений по фильтрам. from/to — ISO-даты
    // по occurredAt, types — список BalanceTransactionType через запятую.
    // Сотрудник без движений — balance: 0 и пустая лента (не 404).
    getEmployeeBalance: (employeeId: number, filters?: { from?: string; to?: string; types?: string[] }) =>
        queryOptions({
            queryKey: [...EMPLOYEE_BALANCE_QUERY_KEY_PREFIX, employeeId, filters ?? null],
            queryFn: ({ signal }): Promise<EmployeeBalanceResponse> =>
                apiInstance
                    .get<EmployeeBalanceResponse>(
                        `/v1/accounting/balance/employee/${employeeId}${buildEmployeeBalanceQuery(filters)}`,
                        { signal },
                    )
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить баланс сотрудника ' + error)
                    }),
        }),

    // GET /v1/accounting/balance/department/:id/:period — сводка общих
    // балансов сотрудников текущего отдела за месяц (состав — из Bitrix24 на
    // момент запроса, не хранится в движении).
    getDepartmentBalances: (departmentId: number, period: string) =>
        queryOptions({
            queryKey: [...DEPARTMENT_BALANCES_QUERY_KEY_PREFIX, departmentId, period],
            queryFn: ({ signal }): Promise<DepartmentBalancesResponse> =>
                apiInstance
                    .get<DepartmentBalancesResponse>(`/v1/accounting/balance/department/${departmentId}/${period}`, {
                        signal,
                    })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить сводку по отделу ' + error)
                    }),
        }),

    // POST .../employee/:id/transactions — ручное движение руководителя
    // (Фаза 7). Ошибка НЕ оборачивается в ApiError (см. SalaryAccruals/model/api.ts)
    // — UI мутации читает сырой AxiosError (response.status/response.data),
    // в частности 400 при отсутствующем обязательном comment для PENALTY/ADJUSTMENT.
    createTransaction: (employeeId: number, payload: CreateBalanceTransactionRequest): Promise<BalanceTransaction> =>
        apiInstance
            .post<BalanceTransaction>(`/v1/accounting/balance/employee/${employeeId}/transactions`, payload)
            .then((r) => r.data),

    // DELETE .../transactions/:id — удалить ошибочное ручное движение без
    // документа ERP (без тела, 204). 409, если это движение начисления
    // (accrualId != null) или erpSyncRequired: true; 404, если не найдено.
    deleteTransaction: (transactionId: string): Promise<void> =>
        apiInstance.delete<void>(`/v1/accounting/balance/transactions/${transactionId}`).then((r) => r.data),
}
