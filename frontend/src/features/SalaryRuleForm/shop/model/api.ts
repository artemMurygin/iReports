import { queryOptions } from '@tanstack/react-query'
import type { CatalogResponse, SalaryRuleTypesResponse } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/**
 * Читающая половина запросов магазина, общая для страницы создания (`pages/SalaryRules`) и
 * страницы редактирования (`pages/SalaryRuleDetail`) — перенесено из
 * `pages/SalaryRules/shop/model/api.ts` (см. план "Редактирование зарплатных схем",
 * `fsdDecisions`). `queryKey`ы не менялись, чтобы кэш обеих страниц оставался общим.
 *
 * POST-мутация `createShopMotivationSchema` НЕ переехала сюда — она специфична для создания и
 * осталась в `pages/SalaryRules/shop/model/api.ts`; PATCH-мутация редактирования живёт в
 * `pages/SalaryRuleDetail/shop/model/api.ts`.
 */
export const api = {
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
}
