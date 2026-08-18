import { useQuery } from '@tanstack/react-query'

import { api } from './api.ts'

/** Shop mirror of `useSalaryRuleTypes.ts` — `GET /v1/shop/accounting/salary_role_types` (Фаза 4).
 * Same response shape as the service endpoint (`SalaryRuleTypesResponse`), separate route/data. */
export function useShopSalaryRuleTypes() {
    return useQuery(api.getShopSalaryRuleTypes())
}
