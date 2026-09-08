import { useMutation } from '@tanstack/react-query'

import { api } from './api.ts'

/** `POST /v1/shop/accounting/motivation-schema` (Фаза 4) — shop mirror of
 * `service/model/useCreateMotivationSchema.ts`. Separate mutation, separate endpoint, separate contract
 * (`ShopMotivationRequestSchema`) — never shares a call site with the service mutation. */
export function useCreateShopMotivationSchema() {
    return useMutation({ mutationFn: api.createShopMotivationSchema })
}
