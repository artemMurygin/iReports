import { queryOptions } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import type { DepartmentSalaryReportResponse, EmployeeSalaryReportResponse } from 'ireports-contracts'

import { api as apiInstance } from '@/shared/api/axios.instance.ts'
import { ApiError } from '@/shared/errors/apiError.ts'

import type { SalaryDirection } from './types.ts'

/**
 * `queryOptions`-фабрики по конвенции `model/api.ts` (см. `frontend/CLAUDE.md`, пример
 * `pages/ServicesReport/model/api.ts`) для `GET /v1/{direction}/accounting/salary_report/...`
 * (`ENDPOINTS.md`). Типы ответов — только `import type` из `ireports-contracts` (рантайм-импорт
 * из этого workspace-пакета ломает Vite dev server, см. комментарий `PeriodPicker.tsx`).
 */
export const api = {
    /**
     * Отчёт сотрудника ОДНОГО направления. Сотрудник, не работающий в этом направлении, отвечает
     * `404` — это не ошибка загрузки страницы (см. PRD, раздел 6, и план: "направление, вернувшее
     * 404/пусто — секцию не рендерить, не считать ошибкой всей страницы"), а обычное валидное
     * состояние "у сотрудника нет отчёта по этому направлению". Поэтому `404` превращается в `null`
     * прямо здесь, а не пробрасывается как `ApiError` — `useEmployeeSalaryReport.ts` читает `null`
     * как "пропустить это направление" при сведении `directions[]`. Любая другая ошибка (сеть,
     * 500 и т. п.) по-прежнему оборачивается в `ApiError`, как и везде в проекте.
     */
    getEmployeeSalaryReport: (direction: SalaryDirection, employeeId: number, period: string) =>
        queryOptions({
            queryKey: ['salary-report', 'employee', direction, employeeId, period],
            queryFn: ({ signal }): Promise<EmployeeSalaryReportResponse | null> =>
                apiInstance
                    .get<EmployeeSalaryReportResponse>(
                        `/v1/${direction}/accounting/salary_report/employee/${employeeId}/${period}`,
                        { signal },
                    )
                    .then((r) => r.data)
                    .catch((error) => {
                        if (isAxiosError(error) && error.response?.status === 404) return null
                        throw new ApiError('Не удалось загрузить отчёт по зарплате сотрудника ' + error)
                    }),
        }),

    /**
     * Отчёт отдела — строго однонаправленный на бэкенде (см. `directionSalaryReportSchema`'s
     * комментарий в контракте), поэтому здесь один запрос на выбранное пользователем направление,
     * без параллельного сведения двух направлений, в отличие от отчёта сотрудника.
     */
    getDepartmentSalaryReport: (direction: SalaryDirection, departmentId: number, period: string) =>
        queryOptions({
            queryKey: ['salary-report', 'department', direction, departmentId, period],
            queryFn: ({ signal }): Promise<DepartmentSalaryReportResponse> =>
                apiInstance
                    .get<DepartmentSalaryReportResponse>(
                        `/v1/${direction}/accounting/salary_report/department/${departmentId}/${period}`,
                        { signal },
                    )
                    .then((r) => r.data)
                    .catch((error) => {
                        throw new ApiError('Не удалось загрузить отчёт по зарплатам отдела ' + error)
                    }),
        }),
}
