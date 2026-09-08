import { useQuery } from '@tanstack/react-query'

import { api } from './api.ts'

/** `GET /v1/service/motivation-schema/:id` — 404 (см. `ApiError`) если схемы нет, либо у неё 0
 * правил направления `service` (apiDesign плана "Редактирование зарплатных схем"). */
export function useMotivationSchema(id: string) {
    return useQuery(api.getMotivationSchema(id))
}
