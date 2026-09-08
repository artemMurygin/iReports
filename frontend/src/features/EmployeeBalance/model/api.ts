import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import type {
    BalanceSummaryResponse,
    BalanceTransaction,
    CreateBalanceTransactionRequest,
    CreatePayoutRequest,
    DepartmentBalancesResponse,
    EmployeeBalanceResponse,
    ErpCashConfigResponse,
    PayoutResponse,
    SalesDirection,
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

/** Ключ сквозного списка взаиморасчётов (docs/employee-settlements-page-redesign, Фаза 1/3):
 * тот же общий баланс, что и у ленты сотрудника, но по всем сотрудникам компании (или одному
 * отделу) сразу — своя точка инвалидации, отдельная от DEPARTMENT_BALANCES_QUERY_KEY_PREFIX
 * выше (то, что заменяет). */
export const BALANCE_SUMMARY_QUERY_KEY_PREFIX = ['balance-summary'] as const

/** Ключ конфигурации кассы ERP направления — читается drawer'ом «Добавить
 * движение» только при выборе типа «Выплата» (Фаза 6
 * docs/employee-settlements-page-redesign), для подписи «Документ: RemOnline
 * · касса Основная» и т.п. Перенесено из бывшей `features/Payout` (удалена
 * той же Фазой 6) — та же причина дублирования, что у HARDCODED_CREATED_BY
 * ниже. */
export const ERP_CASH_CONFIG_QUERY_KEY_PREFIX = ['erp-cash-config'] as const

/** Bitrix24 id руководителя в createdBy ручного движения — тот же
 * захардкоженный приём и по той же причине, что HARDCODED_ACCRUED_BY в
 * features/SalaryAccruals/model/api.ts: модели «текущего пользователя» на
 * фронтенде нет. Задублирована здесь намеренно — кросс-импорт между
 * features запрещён FSD. */
export const HARDCODED_CREATED_BY = 1

/** GET .../employee/:id?from&to&types&cursor — первый прецедент query-параметров
 * from/to/types в проекте: собираются вручную через URLSearchParams (see
 * task), а не через axios `params`, чтобы `types` ушёл строкой через запятую
 * (?types=SALARY_ACCRUAL,ADVANCE), как ожидает бэкенд. `cursor` (Фаза 8
 * docs/employee-settlements-page-redesign) — id последнего движения предыдущей страницы;
 * `undefined` на первой странице (см. `initialPageParam` в `getEmployeeBalance` ниже) — `limit`
 * сознательно не передаётся вовсе, дефолт (20) — ответственность бэкенда
 * (DEFAULT_BALANCE_TRANSACTIONS_PAGE_LIMIT), см. WHY в contracts/commands/employee-balance.ts. */
function buildEmployeeBalanceQuery(
    filters?: { from?: string; to?: string; types?: string[] },
    cursor?: string,
): string {
    const params = new URLSearchParams()
    if (filters?.from !== undefined) params.set('from', filters.from)
    if (filters?.to !== undefined) params.set('to', filters.to)
    if (filters?.types !== undefined && filters.types.length > 0) params.set('types', filters.types.join(','))
    if (cursor !== undefined) params.set('cursor', cursor)
    const query = params.toString()
    return query.length > 0 ? `?${query}` : ''
}

/** Выплата (`POST/DELETE .../payout*`, `GET .../erp_cash_config`) — в отличие от
 * остального этого файла, per-direction (своя касса ERP на направление, PRD 3
 * docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md),
 * тот же приём `basePath(direction)`, что был в бывшей `features/Payout/model/api.ts`
 * (удалена Фазой 6 docs/employee-settlements-page-redesign — точка входа переехала
 * в `NewTransactionDrawer` этой фичи). */
function payoutBasePath(direction: SalesDirection): string {
    return direction === 'shop' ? '/v1/shop/accounting' : '/v1/service/accounting'
}

export const api = {
    // GET /v1/accounting/balance/employee/:id?from&to&types&cursor — курсорная пагинация «за всё
    // время» (Фаза 8 docs/employee-settlements-page-redesign, бэкенд — Фаза 7): остаток
    // (`balance`, не зависит от фильтров/страницы) и лента ТЕКУЩЕЙ страницы движений по фильтрам.
    // from/to — ISO-даты по occurredAt (не передаются вовсе, когда страница показывает «за всё
    // время» — см. `useEmployeeBalancePage`), types — список BalanceTransactionType через запятую
    // (фильтр по типу — серверный, не клиентский: «загрузить ещё» продолжает уважать текущие
    // типы, а не просто следующие 20 без учёта фильтра). Сотрудник без движений — balance: 0 и
    // пустая лента (не 404).
    //
    // `infiniteQueryOptions` (не `queryOptions`, как раньше, до Фазы 8): страница читается
    // порциями по 20 (`hasMore`/`nextCursor` в ответе), а не одним запросом целиком —
    // `pageParam` это тот самый курсор. `initialPageParam: undefined` — первая страница «без
    // курсора» (сервер трактует его отсутствие как «начало ленты», см. WHY в
    // `getEmployeeBalanceQuerySchema`, contracts/commands/employee-balance.ts).
    getEmployeeBalance: (employeeId: number, filters?: { from?: string; to?: string; types?: string[] }) =>
        infiniteQueryOptions({
            queryKey: [...EMPLOYEE_BALANCE_QUERY_KEY_PREFIX, employeeId, filters ?? null],
            queryFn: ({ pageParam, signal }): Promise<EmployeeBalanceResponse> =>
                apiInstance
                    .get<EmployeeBalanceResponse>(
                        `/v1/accounting/balance/employee/${employeeId}${buildEmployeeBalanceQuery(filters, pageParam)}`,
                        { signal },
                    )
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить баланс сотрудника ' + error)
                    }),
            initialPageParam: undefined as string | undefined,
            // hasMore: false -> undefined (не last page.nextCursor, которое контракт всё равно
            // гарантирует null в этом случае, но undefined — то, что ждёт getNextPageParam как
            // «страниц больше нет», см. TanStack Query docs).
            getNextPageParam: (lastPage) => (lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined),
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

    // GET /v1/accounting/balance/summary/:period?departmentId&search — сквозной (без
    // направления) список сотрудников с текущим общим балансом, docs/employee-settlements-page-
    // redesign Фаза 1/3: без departmentId — все отделы компании, с ним — состав одного отдела
    // (из Bitrix24). search — регистронезависимая подстрока по «Имя Фамилия», применяется
    // бэкендом ДО расчёта KPI-агрегатов (totals уже учитывают текущий search/departmentId).
    // :period в пути обязателен форматом (см. WHY в GetBalanceSummaryService), сам остаток от
    // периода не зависит — здесь всегда DEFAULT_PERIOD, страница не даёт его выбирать.
    getBalanceSummary: (period: string, filter: { departmentId?: number; search?: string }) =>
        queryOptions({
            queryKey: [...BALANCE_SUMMARY_QUERY_KEY_PREFIX, period, filter.departmentId ?? null, filter.search ?? ''],
            queryFn: ({ signal }): Promise<BalanceSummaryResponse> => {
                const params = new URLSearchParams()
                if (filter.departmentId !== undefined) params.set('departmentId', String(filter.departmentId))
                if (filter.search !== undefined && filter.search.length > 0) params.set('search', filter.search)
                const query = params.toString()
                return apiInstance
                    .get<BalanceSummaryResponse>(
                        `/v1/accounting/balance/summary/${period}${query.length > 0 ? `?${query}` : ''}`,
                        { signal },
                    )
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить сводку взаиморасчётов ' + error)
                    })
            },
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

    // GET .../erp_cash_config — подпись кассы/статьи для типа «Выплата» в
    // `NewTransactionDrawer` (read-only, без выбора, P3.1). null-поля значат
    // «направление не сконфигурировано» — drawer показывает это как «Касса
    // не настроена», а не падает.
    getErpCashConfig: (direction: SalesDirection) =>
        queryOptions({
            queryKey: [...ERP_CASH_CONFIG_QUERY_KEY_PREFIX, direction],
            queryFn: ({ signal }): Promise<ErpCashConfigResponse> =>
                apiInstance
                    .get<ErpCashConfigResponse>(`${payoutBasePath(direction)}/erp_cash_config`, { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить конфигурацию кассы ' + error)
                    }),
        }),

    // POST .../payout — выплата (тип «Выплата» в `NewTransactionDrawer`).
    // Ошибка НЕ оборачивается в ApiError (см. WHY выше у createTransaction) —
    // UI мутации читает сырой AxiosError: 409 несёт `PayoutConfirmationRequired`
    // в `error.response.data.metadata` (см. `readPayoutConfirmationRequired`,
    // model/payoutHelpers.ts).
    createPayout: (direction: SalesDirection, payload: CreatePayoutRequest): Promise<PayoutResponse> =>
        apiInstance.post<PayoutResponse>(`${payoutBasePath(direction)}/payout`, payload).then((r) => r.data),

    // DELETE .../payout/:id — удалить выплату (id — BalanceTransaction.id
    // движения PAYOUT из ленты): ERP delete → транзакция (удаление движения +
    // возврат затронутых документов начисления из PAID в ACCRUED). Без тела,
    // 204; ошибка НЕ оборачивается в ApiError — тот же приём, что createPayout.
    deletePayout: (direction: SalesDirection, transactionId: string): Promise<void> =>
        apiInstance.delete<void>(`${payoutBasePath(direction)}/payout/${transactionId}`).then((r) => r.data),
}
