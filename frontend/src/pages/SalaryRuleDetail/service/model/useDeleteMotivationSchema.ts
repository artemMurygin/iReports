import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from './api.ts'

/**
 * `DELETE /v1/service/motivation-schema/:id` — удаление мотивационной схемы направления `service`
 * целиком (FR1 delete-motivation-schema). При успехе инвалидирует список схем
 * (`pages/SalaryRuleList`'s `['salary-rule-list', 'schemas']`) — удалённая схема не должна
 * появиться там из кэша.
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
