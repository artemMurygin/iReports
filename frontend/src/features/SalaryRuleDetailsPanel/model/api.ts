import { queryOptions } from '@tanstack/react-query'
import type { SalaryRuleDetail, SalesDirection } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError, extractApiErrorMessage } from '@/shared/errors/apiError.ts'

/**
 * add-task-salary-rule-links-comments, tasks.md группа 28 — read-only боковая панель зарплатного
 * правила (`GetSalaryRuleService.execute`, `GET /v1/{direction}/accounting/salary-rules/:ruleId`,
 * architecture.md «HTTP-эндпоинты» -> `GetSalaryRuleHttpController` ×2). Панель открывается с
 * карточки задачи, направление ей передаёт вызывающий код (`useTaskSalaryReference`/
 * `useSalaryRulePanel`) — сама панель направление не резолвит (design.md решение 3 касается только
 * поиска правила по `taskId`, не этого эндпоинта).
 *
 * `queryKey` включает `direction` (а не только `ruleId`) по прецеденту
 * `TaskStatusControl/model/api.ts`'s `TASKS_QUERY_KEY_PREFIX` + собственному кросс-доменному приёму
 * `EmployeeBalance/model/api.ts`'s `payoutBasePath` — id правила уникален только внутри своего
 * домена, кэш service/shop не должен пересекаться при совпадении id.
 */
export const SALARY_RULE_DETAIL_QUERY_KEY_PREFIX = ['salary-rule-details-panel', 'salary-rule'] as const

function salaryRuleBasePath(direction: SalesDirection): string {
    return `/v1/${direction}/accounting/salary-rules`
}

export const salaryRuleApi = {
    get: (direction: SalesDirection, ruleId: string) =>
        queryOptions({
            queryKey: [...SALARY_RULE_DETAIL_QUERY_KEY_PREFIX, direction, ruleId],
            queryFn: ({ signal }): Promise<SalaryRuleDetail> =>
                apiInstance
                    .get<SalaryRuleDetail>(`${salaryRuleBasePath(direction)}/${ruleId}`, { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError(extractApiErrorMessage(error, 'Не удалось загрузить зарплатное правило'))
                    }),
        }),

    // Soft-деактивация/восстановление ОДНОГО правила (`isActive` на `SalaryRuleDetail` выше) —
    // `POST .../salary-rules/:ruleId/{deactivate,activate}`, `204 No Content`. Единственное место
    // в приложении, где неактивное правило вообще видно (обычный список правил схемы его скрывает),
    // поэтому переключатель живёт здесь же, в `SalaryRuleDetailsPanel` — см. `useSalaryRuleActivation.ts`.
    deactivate: (direction: SalesDirection, ruleId: string): Promise<void> =>
        apiInstance
            .post(`${salaryRuleBasePath(direction)}/${ruleId}/deactivate`)
            .then(() => undefined)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось деактивировать правило'))
            }),

    activate: (direction: SalesDirection, ruleId: string): Promise<void> =>
        apiInstance
            .post(`${salaryRuleBasePath(direction)}/${ruleId}/activate`)
            .then(() => undefined)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось активировать правило'))
            }),
}
