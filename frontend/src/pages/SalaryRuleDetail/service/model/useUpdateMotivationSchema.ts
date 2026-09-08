import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UpdateMotivationSchemaRequest } from 'ireports-contracts'

import { api } from './api.ts'

/**
 * `PATCH /v1/service/motivation-schema/:id` — переименование + полная замена набора правил
 * направления `service` (см. `ENDPOINTS.md`). При успехе инвалидирует и список схем
 * (`pages/SalaryRuleList`'s `['salary-rule-list', 'schemas']` — карточка/чипы/счётчик должны
 * подхватить новые данные при возврате туда), и собственный детальный кэш этой схемы (на случай,
 * если пользователь останется на странице/вернётся назад, а не уйдёт к списку).
 */
export function useUpdateMotivationSchema(id: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (payload: UpdateMotivationSchemaRequest) => api.updateMotivationSchema(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salary-rule-list'] })
            queryClient.invalidateQueries({ queryKey: ['motivation-schema', 'service', id] })
        },
    })
}
