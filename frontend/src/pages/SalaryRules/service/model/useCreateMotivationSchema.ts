import { useMutation, useQueryClient } from '@tanstack/react-query'

import { api } from './api.ts'

/** `POST /v1/service/motivation-schema` — первая мутация в проекте (см. комментарий в
 * `service/model/api.ts`); тонкая обёртка над `useMutation`, чтобы `useServiceDirection.ts` не знала
 * о форме `queryFn`-функции напрямую и могла читать `isPending`/`isSuccess`/`error` как обычный хук.
 * При успехе инвалидирует список схем (`pages/SalaryRuleList`'s `['salary-rule-list', 'schemas']`,
 * см. `pages/SalaryRuleDetail/service/model/useUpdateMotivationSchema.ts`) — иначе список не
 * подхватывает только что созданную схему без ручного обновления страницы. */
export function useCreateMotivationSchema() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: api.createMotivationSchema,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['salary-rule-list'] })
        },
    })
}
