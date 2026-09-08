import { useQuery } from '@tanstack/react-query'

import { api } from './api.ts'

/** `GET /v1/shop/accounting/motivation-schema/:id` — зеркало `service/model/useMotivationSchema.ts`. */
export function useMotivationSchema(id: string) {
    return useQuery(api.getMotivationSchema(id))
}
