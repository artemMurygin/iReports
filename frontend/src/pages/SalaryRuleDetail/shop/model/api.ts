import { queryOptions } from '@tanstack/react-query'
import type {
    ShopMotivationResponse,
    ShopMotivationSchemaDetailResponse,
    UpdateShopMotivationSchemaRequest,
} from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/** `GET`/`PATCH /v1/shop/accounting/motivation-schema/:id` — зеркало `service/model/api.ts`. */
export const api = {
    getMotivationSchema: (id: string) =>
        queryOptions({
            queryKey: ['motivation-schema', 'shop', id],
            queryFn: ({ signal }): Promise<ShopMotivationSchemaDetailResponse> =>
                apiInstance
                    .get<ShopMotivationSchemaDetailResponse>(`/v1/shop/accounting/motivation-schema/${id}`, { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить зарплатную схему магазина ' + error)
                    }),
        }),

    updateMotivationSchema: (id: string, payload: UpdateShopMotivationSchemaRequest): Promise<ShopMotivationResponse> =>
        apiInstance
            .patch<ShopMotivationResponse>(`/v1/shop/accounting/motivation-schema/${id}`, payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError('Не удалось сохранить изменения схемы магазина ' + error)
            }),
}
