import type { ShopMotivationRequest, ShopMotivationResponse } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError, extractApiErrorMessage } from '@/shared/errors/apiError.ts'

/**
 * Фаза 4 (docs/salary-schema-creation-ui) — POST-мутация создания зарплатной схемы магазина
 * (обычная async-функция, разворачиваемая в
 * `useMutation({ mutationFn: api.createShopMotivationSchema })` в
 * `shop/model/useCreateShopMotivationSchema.ts` — не `queryOptions`, тот тип предназначен только для
 * чтения; см. frontend/CLAUDE.md, раздел "Query options factory").
 *
 * `getShopSalaryRuleTypes`/`getCatalog` переехали в `features/SalaryRuleForm/shop/model/api.ts` —
 * читающие запросы нужны и странице создания, и странице редактирования (`pages/SalaryRuleDetail`),
 * которая не может импортировать `pages/SalaryRules` напрямую (page→page запрещён).
 *
 * Отдельный путь и контракт (`ShopMotivationRequestSchema`,
 * `contracts/commands/shop-motivation-schema.ts`), НЕ переиспользует сервисный
 * `createMotivationSchema` из `service/model/api.ts` (см. `shop-salary-rule.ts`'s header comment).
 */
export const api = {
    createShopMotivationSchema: (payload: ShopMotivationRequest): Promise<ShopMotivationResponse> =>
        apiInstance
            .post<ShopMotivationResponse>('/v1/shop/accounting/motivation-schema', payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось сохранить зарплатную схему магазина'))
            }),
}
