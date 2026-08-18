import { useMutation } from '@tanstack/react-query'

import { api } from './api.ts'

/** `POST /v1/service/motivation-schema` — первая мутация в проекте (см. комментарий в
 * `model/api.ts`); тонкая обёртка над `useMutation`, чтобы `SalaryRulesPage` не знала о форме
 * `queryFn`-функции напрямую и могла читать `isPending`/`isSuccess`/`error` как обычный хук. */
export function useCreateMotivationSchema() {
    return useMutation({ mutationFn: api.createMotivationSchema })
}
