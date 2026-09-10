import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from './api.ts'

/** `POST /v1/shop/accounting/motivation-schema` (Фаза 4) — shop mirror of
 * `service/model/useCreateMotivationSchema.ts`. Separate mutation, separate endpoint, separate contract
 * (`ShopMotivationRequestSchema`) — never shares a call site with the service mutation.
 * Invalidates the shared schema list (`['salary-rule-list', 'schemas']`) on success, same as the
 * service mutation, so a newly created schema shows up without a manual page reload. */
export function useCreateShopMotivationSchema() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: api.createShopMotivationSchema,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salary-rule-list'] })
        },
    })
}
