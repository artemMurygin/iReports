import { useQuery } from '@tanstack/react-query'

import { api } from './api.ts'

/**
 * Implements FR4 of add-department-head-salary-rules.
 *
 * Справочник складов МойСклад (`GET /v1/shop/warehouse/stores`) для `WarehouseField` у правила
 * `DepartmentTurnoverBonus` (Фаза 5, add-department-head-salary-rules) — зеркало
 * `service/model/useWarehouses.ts`.
 */
export function useStores() {
    return useQuery(api.getStores())
}
