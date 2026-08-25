import { useQuery } from '@tanstack/react-query'

import { api } from './api.ts'

/** Справочник типов заказов RoApp (`GET /v1/service/reports/order-type`) для мультиселекта
 * `OrderTypeField` у правил `OrderPayed`/`ServiceCompleted` (Фаза 5,
 * docs/service-plan-salary-rule-order-category-filter). Направление у справочника только service
 * (см. PRD, "не в скоупе: shop") — `useShopDirection.ts` его не вызывает вовсе. */
export function useOrderTypes() {
    return useQuery(api.getOrderTypes())
}
