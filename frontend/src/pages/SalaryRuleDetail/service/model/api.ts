import { queryOptions } from '@tanstack/react-query'
import type {
    MotivationResponse,
    MotivationSchemaDetailResponse,
    UpdateMotivationSchemaRequest,
} from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError, extractApiErrorMessage } from '@/shared/errors/apiError.ts'

/**
 * `GET`/`PATCH /v1/service/motivation-schema/:id` — зеркалит структуру `pages/SalaryRules/service/model/api.ts`.
 * `queryKey` (`['motivation-schema', 'service', id]`) — своё, отдельное от списка
 * (`pages/SalaryRuleList`'s `['salary-rule-list', 'schemas']`); после успешного `PATCH` инвалидируются
 * оба (см. `useUpdateMotivationSchema.ts`).
 */
export const api = {
    getMotivationSchema: (id: string) =>
        queryOptions({
            queryKey: ['motivation-schema', 'service', id],
            queryFn: ({ signal }): Promise<MotivationSchemaDetailResponse> =>
                apiInstance
                    .get<MotivationSchemaDetailResponse>(`/v1/service/motivation-schema/${id}`, { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError(extractApiErrorMessage(error, 'Не удалось загрузить зарплатную схему'))
                    }),
        }),

    updateMotivationSchema: (id: string, payload: UpdateMotivationSchemaRequest): Promise<MotivationResponse> =>
        apiInstance
            .patch<MotivationResponse>(`/v1/service/motivation-schema/${id}`, payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось сохранить изменения схемы'))
            }),
}
