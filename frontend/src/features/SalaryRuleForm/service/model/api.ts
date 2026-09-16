import { queryOptions } from '@tanstack/react-query'
import type {
    ListServiceCategoriesResponse,
    ListWarehousesResponse,
    OrderTypeResponse,
    SalaryRuleTypesResponse,
} from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/**
 * Читающая половина сервисных запросов правил, общая для страницы создания
 * (`pages/SalaryRules`) и страницы редактирования (`pages/SalaryRuleDetail`) — перенесено из
 * `pages/SalaryRules/service/model/api.ts` (см. план "Редактирование зарплатных схем",
 * `fsdDecisions`). `queryKey` не менялся, чтобы кэш обеих страниц оставался общим.
 *
 * POST-мутация `createMotivationSchema` НЕ переехала сюда — она специфична для создания и
 * осталась в `pages/SalaryRules/service/model/api.ts`; PATCH-мутация редактирования (своя, другой
 * payload) живёт в `pages/SalaryRuleDetail/service/model/api.ts`.
 */
export const api = {
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

    // GET /v1/service/reports/order-type — read-only справочник типов заказов RoApp (Фаза 1,
    // docs/service-plan-salary-rule-order-category-filter), для мультиселекта "типы заказов"
    // (`OrderTypeField`) у правил `OrderPayed`/`ServiceCompleted` (Фаза 5). Тот же эндпоинт, что
    // `features/SalesPlan/model/api.ts`'s `getOrderTypes` использует для плана продаж — своя копия
    // запроса здесь (не импорт того файла: features не могут импортировать друг друга,
    // frontend/CLAUDE.md), но `queryKey` уже начинается с `salary-rules`, так что коллизии кэша с
    // планом продаж нет.
    getOrderTypes: () =>
        queryOptions({
            queryKey: ['salary-rules', 'service', 'order-types'],
            staleTime: 30 * 60 * 1000,
            queryFn: ({ signal }): Promise<OrderTypeResponse[]> =>
                apiInstance
                    .get<OrderTypeResponse[]>('/v1/service/reports/order-type', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить типы заказов ' + error)
                    }),
        }),

    // GET /v1/service/warehouse/warehouses — справочник складов RemOnline (FR4 of
    // add-department-head-salary-rules), для `WarehouseField` у правила `DepartmentTurnoverBonus`.
    // Тот же эндпоинт, что `pages/GoodsTurnoverReport/model/api.ts`'s `getWarehouses` использует для
    // фильтра склада — своя копия запроса здесь (features не могут импортировать pages/друг друга,
    // frontend/CLAUDE.md), с отдельным `queryKey`.
    getWarehouses: () =>
        queryOptions({
            queryKey: ['salary-rules', 'service', 'warehouses'],
            staleTime: 30 * 60 * 1000,
            queryFn: ({ signal }): Promise<ListWarehousesResponse> =>
                apiInstance
                    .get<ListWarehousesResponse>('/v1/service/warehouse/warehouses', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить справочник складов ' + error)
                    }),
        }),

    // GET /v1/service/reports/service-categories — справочник категорий услуг RemOnline (плоский
    // список, `contracts/commands/report.ts`), для `CategoryField` у правил `DepartmentPercent`/
    // `DepartmentPlanBonus`/`DepartmentTurnoverBonus` (у сервисных department-правил `category` —
    // тот же scope-параметр, что у `ProductSold.config.category` в shop, см.
    // `contracts/commands/salary-rule.ts`). Тот же эндпоинт, что `pages/ServicesReport/model/api.ts`'s
    // `getCategories` использует для отчёта по услугам — своя копия запроса здесь (features не могут
    // импортировать pages/друг друга, frontend/CLAUDE.md), с отдельным `queryKey`.
    getServiceCategories: () =>
        queryOptions({
            queryKey: ['salary-rules', 'service', 'categories'],
            staleTime: 30 * 60 * 1000,
            queryFn: ({ signal }): Promise<ListServiceCategoriesResponse> =>
                apiInstance
                    .get<ListServiceCategoriesResponse>('/v1/service/reports/service-categories', { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить категории услуг ' + error)
                    }),
        }),
}
