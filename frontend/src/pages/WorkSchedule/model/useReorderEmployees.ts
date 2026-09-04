import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ReorderEmployeesRequest, ReorderEmployeesResponse } from 'ireports-contracts'

import { EMPLOYEES_QUERY_KEY } from '@/features/TargetDirectory'

import { api, WORK_SCHEDULE_QUERY_KEY_PREFIX } from './api.ts'

/**
 * Мутация `PATCH .../employees/order` (Фаза 2, docs/employee-ordering-and-salary-filter) —
 * вызывается из `useWorkSchedulePage.handleReorderEmployees` после drag-n-drop строки сотрудника.
 *
 * Порядок — общий на всю компанию (PRD, "В скоупе" п.4), поэтому успешный ответ (уже весь
 * справочник в новом порядке, см. `api.reorderEmployees`'s комментарий) сразу кладётся в кэш
 * `features/TargetDirectory`'s `useEmployees()` (`setQueryData`, без лишнего повторного GET) —
 * этим кэшем питаются справочник выбора сотрудника при создании зарплатной схемы
 * (`pages/SalaryRules`), шапка отчёта сотрудника (`pages/SalaryReportV2`) и ФИО в ленте
 * взаиморасчётов (`pages/EmployeeBalance`), так что новый порядок виден им сразу же, без
 * отдельного захода на страницу графика работы.
 *
 * `WORK_SCHEDULE_QUERY_KEY_PREFIX` инвалидируется тем же приёмом, что и `useSaveWorkScheduleEntry`
 * — таблица самой страницы графика перечитывает месяц уже в новом порядке. Мутация ДОЖИДАЕТСЯ
 * (`await`) завершения этой инвалидации (а не просто вызывает её) — вызывающий код
 * (`useWorkSchedulePage`) держит локальный оптимистичный оверрайд порядка ровно до того момента,
 * пока этот `mutate`/`mutateAsync` не разрешится, и снимает его в своём `onSuccess`; если снять
 * оверрайд раньше, чем реальный рефетч долетит, строка на миг мигнёт обратно в старый порядок.
 */
export function useReorderEmployees() {
    const queryClient = useQueryClient()

    return useMutation<ReorderEmployeesResponse, Error, ReorderEmployeesRequest>({
        mutationFn: (payload) => api.reorderEmployees(payload),
        onSuccess: async (data) => {
            queryClient.setQueryData(EMPLOYEES_QUERY_KEY, data)
            await queryClient.invalidateQueries({ queryKey: WORK_SCHEDULE_QUERY_KEY_PREFIX })
        },
        onError: (error) => {
            toast.error('Не удалось сохранить порядок сотрудников', { description: error.message })
        },
    })
}
