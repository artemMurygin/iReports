import { useQuery } from '@tanstack/react-query'

import { api } from './api.ts'

/**
 * Implements FR4 of add-department-head-salary-rules.
 *
 * Справочник складов RemOnline (`GET /v1/service/warehouse/warehouses`) для `WarehouseField` у
 * правила `DepartmentTurnoverBonus` (Фаза 5, add-department-head-salary-rules). Направление у
 * справочника только service (МойСклад-версия — `shop/model/useStores.ts`).
 */
export function useWarehouses() {
    return useQuery(api.getWarehouses())
}
