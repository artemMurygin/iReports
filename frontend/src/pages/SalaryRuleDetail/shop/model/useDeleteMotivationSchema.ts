import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from './api.ts'

/**
 * `DELETE /v1/shop/accounting/motivation-schema/:id` — удаление мотивационной схемы направления
 * `shop` целиком (FR2 delete-motivation-schema). Зеркало
 * `service/model/useDeleteMotivationSchema.ts`.
 */
export function useDeleteMotivationSchema(id: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: () => api.deleteMotivationSchema(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salary-rule-list'] })
        },
    })
}
