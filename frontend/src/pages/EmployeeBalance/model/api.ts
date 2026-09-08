import { queryOptions } from '@tanstack/react-query'
import type { EmployeeIdentityResponse } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

/**
 * Один запрос, локальный для страницы (docs/employee-settlements-page-redesign, Фаза 5): связи
 * ОДНОГО сотрудника с ERP-системами, для строки шапки «связан с RemOnline и МойСкладом»
 * (`ERP-документ уже есть в ленте (см. features/EmployeeBalance), связка сотрудник × система —
 * отдельный справочник `modules/employee-identity`, см. ENDPOINTS.md). Использует
 * `GET /v1/employee-identity/employee/:employeeId` (не `GET /v1/employee-identity` целиком, как
 * `pages/EmployeeIdentity` — тому нужна таблица по всем сотрудникам сразу, здесь ровно один) —
 * `pages/EmployeeIdentity/model/api.ts` не переиспользуется: кросс-импорт между `pages`
 * запрещён FSD (frontend/CLAUDE.md), поэтому маленький GET продублирован здесь напрямую.
 */
export const api = {
    getEmployeeIdentities: (employeeId: number) =>
        queryOptions({
            queryKey: ['employee-balance', 'identities', employeeId],
            queryFn: ({ signal }): Promise<EmployeeIdentityResponse[]> =>
                apiInstance
                    .get<EmployeeIdentityResponse[]>(`/v1/employee-identity/employee/${employeeId}`, { signal })
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить связи сотрудника с ERP ' + error)
                    }),
        }),
}
