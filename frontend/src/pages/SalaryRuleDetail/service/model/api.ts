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

    // FR1 delete-motivation-schema.
    deleteMotivationSchema: (id: string): Promise<void> =>
        apiInstance
            .delete(`/v1/service/motivation-schema/${id}`)
            .then(() => undefined)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось удалить схему'))
            }),

    // add-task-rule-task-lifecycle — удаляет ОДНО правило вместе с его задачей немедленно (не
    // через PATCH .../motivation-schema/:id выше — тот делает полную замену набора правил и требует
    // отдельного "Сохранить"). Используется только для уже сохранённого правила (`draft.ruleId`
    // задан) — см. WHY в `TaskCompletionRuleFields.tsx`.
    deleteSalaryRule: (ruleId: string): Promise<void> =>
        apiInstance
            .delete(`/v1/service/accounting/salary-rules/${ruleId}`)
            .then(() => undefined)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось удалить правило'))
            }),

    // Soft-delete уже сохранённого правила — правило перестаёт участвовать в расчётах и пропадает
    // из списка `rules` в `GET .../motivation-schema/:id` (см. `isActive` comment в
    // `contracts/commands/salary-rule.ts`), но не удаляется физически. Не через `PATCH
    // .../motivation-schema/:id` (тот делает полную замену набора правил) — отдельный эндпоинт,
    // обратимый через `POST .../salary-rules/:ruleId/activate`.
    deactivateSalaryRule: (ruleId: string): Promise<void> =>
        apiInstance
            .post(`/v1/service/accounting/salary-rules/${ruleId}/deactivate`)
            .then(() => undefined)
            .catch((error) => {
                throw new ApiError(extractApiErrorMessage(error, 'Не удалось деактивировать правило'))
            }),
}
