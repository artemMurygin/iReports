import { queryOptions } from '@tanstack/react-query'
import type {
    CatalogResponse,
    ListDepartmentsResponse,
    ListEmployeesResponse,
    MotivationRequest,
    MotivationResponse,
    SalaryRuleTypesResponse,
    ShopMotivationRequest,
    ShopMotivationResponse,
} from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/**
 * Фаза 2 (docs/salary-schema-creation-ui) — Шаг 1/2 создания зарплатной схемы сервиса. Три
 * `queryOptions`-фабрики (справочник отделов/сотрудников из Фазы 1, типы правил сервиса) по
 * паттерну `pages/ServicesReport/model/api.ts`, плюс одна POST-мутация — первая в проекте
 * (см. frontend/CLAUDE.md, раздел "Query options factory"; для `queryFn` паттерн уже
 * задокументирован, для мутации явного паттерна ещё не было, поэтому она оформлена как обычная
 * async-функция рядом, разворачиваемая в `useMutation({ mutationFn: api.createMotivationSchema })`
 * в `model/useCreateMotivationSchema.ts` — не `queryOptions`, тот тип предназначен только для
 * чтения).
 *
 * Фаза 4 добавляет магазинные эндпоинты (`getShopSalaryRuleTypes`/`getCatalog`/
 * `createShopMotivationSchema`) — отдельные пути и контракты (`ShopMotivationRequestSchema`,
 * `contracts/commands/shop-motivation-schema.ts`), НЕ переиспользуют сервисные `getSalaryRuleTypes`/
 * `createMotivationSchema` (см. `shop-salary-rule.ts`'s header comment).
 */
export const api = {
    getDepartments: () =>
        queryOptions({
            queryKey: ['salary-rules', 'departments'],
            staleTime: 5 * 60 * 1000,
            queryFn: ({ signal }): Promise<ListDepartmentsResponse> =>
                apiInstance
                    .get<ListDepartmentsResponse>('/v1/directory/departments', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить список отделов ' + error)
                    }),
        }),

    getEmployees: () =>
        queryOptions({
            queryKey: ['salary-rules', 'employees'],
            staleTime: 5 * 60 * 1000,
            queryFn: ({ signal }): Promise<ListEmployeesResponse> =>
                apiInstance
                    .get<ListEmployeesResponse>('/v1/directory/employees', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить список сотрудников ' + error)
                    }),
        }),

    getSalaryRuleTypes: () =>
        queryOptions({
            queryKey: ['salary-rules', 'service', 'salary-rule-types'],
            staleTime: 30 * 60 * 1000,
            queryFn: ({ signal }): Promise<SalaryRuleTypesResponse> =>
                apiInstance
                    .get<SalaryRuleTypesResponse>('/v1/service/accounting/salary_role_types', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить типы зарплатных правил ' + error)
                    }),
        }),

    createMotivationSchema: (payload: MotivationRequest): Promise<MotivationResponse> =>
        apiInstance
            .post<MotivationResponse>('/v1/service/motivation-schema', payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError('Не удалось сохранить зарплатную схему ' + error)
            }),

    getShopSalaryRuleTypes: () =>
        queryOptions({
            queryKey: ['salary-rules', 'shop', 'salary-rule-types'],
            staleTime: 30 * 60 * 1000,
            queryFn: ({ signal }): Promise<SalaryRuleTypesResponse> =>
                apiInstance
                    .get<SalaryRuleTypesResponse>('/v1/shop/accounting/salary_role_types', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить типы зарплатных правил магазина ' + error)
                    }),
        }),

    getCatalog: () =>
        queryOptions({
            queryKey: ['salary-rules', 'shop', 'catalog'],
            staleTime: 5 * 60 * 1000,
            queryFn: ({ signal }): Promise<CatalogResponse> =>
                apiInstance
                    .get<CatalogResponse>('/v1/shop/warehouse/catalog', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить категории каталога ' + error)
                    }),
        }),

    createShopMotivationSchema: (payload: ShopMotivationRequest): Promise<ShopMotivationResponse> =>
        apiInstance
            .post<ShopMotivationResponse>('/v1/shop/accounting/motivation-schema', payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError('Не удалось сохранить зарплатную схему магазина ' + error)
            }),
}
