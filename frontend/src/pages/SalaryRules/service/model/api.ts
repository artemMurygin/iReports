import type { MotivationRequest, MotivationResponse } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError, extractApiErrorMessage } from '@/shared/errors/apiError.ts'

/**
 * Фаза 2 (docs/salary-schema-creation-ui) — POST-мутация создания зарплатной схемы сервиса (первая
 * мутация в проекте, см. frontend/CLAUDE.md, раздел "Query options factory": для `queryFn` паттерн
 * уже задокументирован, для мутации явного паттерна ещё не было, поэтому она оформлена как обычная
 * async-функция рядом, разворачиваемая в `useMutation({ mutationFn: api.createMotivationSchema })`
 * в `service/model/useCreateMotivationSchema.ts` — не `queryOptions`, тот тип предназначен только
 * для чтения).
 *
 * `getSalaryRuleTypes` переехал в `features/SalaryRuleForm/service/model/api.ts` — читающий
 * запрос типов правил нужен и странице создания, и странице редактирования
 * (`pages/SalaryRuleDetail`, docs "Редактирование зарплатных схем"), которая не может
 * импортировать `pages/SalaryRules` напрямую (page→page запрещён).
 *
 * Справочник отделов/сотрудников (`getDepartments`/`getEmployees`) переехал в
 * `features/TargetDirectory/model/api.ts` — переиспользуемая бизнес-логика, нужная и
 * `pages/SalaryRuleList`, который не может импортировать эту страницу напрямую.
 *
 * Магазинная POST-мутация (`createShopMotivationSchema`) живёт в `shop/model/api.ts` — отдельный
 * путь и контракт (`ShopMotivationRequestSchema`, `contracts/commands/shop-motivation-schema.ts`),
 * НЕ переиспользует сервисный `createMotivationSchema` (см. `shop-salary-rule.ts`'s header comment).
 */
export const api = {
    createMotivationSchema: (payload: MotivationRequest): Promise<MotivationResponse> =>
        apiInstance
            .post<MotivationResponse>('/v1/service/motivation-schema', payload)
            .then((r) => r.data)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось сохранить зарплатную схему'))
            }),
}
