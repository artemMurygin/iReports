import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UpdateShopMotivationSchemaRequest } from 'ireports-contracts'

import { api } from './api.ts'

/** `PATCH /v1/shop/accounting/motivation-schema/:id` — зеркало `service/model/useUpdateMotivationSchema.ts`. */
export function useUpdateMotivationSchema(id: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (payload: UpdateShopMotivationSchemaRequest) => api.updateMotivationSchema(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salary-rule-list'] })
            queryClient.invalidateQueries({ queryKey: ['motivation-schema', 'shop', id] })
        },
    })
}
