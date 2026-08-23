import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SalesDirection } from 'ireports-contracts'

import { SALARY_ACCRUALS_QUERY_KEY_PREFIX, api } from './api.ts'

/**
 * Мутации действий над начислением (Фаза 9 docs/payroll-closing-and-accrual, PRD 2):
 * проведение/отмена/корректировка строки и массовое проведение документа/периода.
 * Все после успеха инвалидируют:
 * - весь префикс фичи (список документов + карточки всех направлений/периодов);
 * - `['sales-plan']` — то же, что закрытие периода (см. usePeriodMutations.ts):
 *   проведение меняет факт, который читает план продаж;
 * - `['salary-report']` — отчёт по зарплате сотрудника/отдела читает статусы строк
 *   и остатки баланса, изменённые проведением/отменой/корректировкой.
 * Ошибки мутаций НЕ оборачиваются в ApiError (см. комментарий в api.ts) — UI читает
 * сырой AxiosError (response.status/response.data) для текста ошибки сервера.
 */

export function useInvalidateSalaryAccrualsData() {
    const queryClient = useQueryClient()
    return () => {
        void queryClient.invalidateQueries({ queryKey: SALARY_ACCRUALS_QUERY_KEY_PREFIX })
        void queryClient.invalidateQueries({ queryKey: ['sales-plan'] })
        void queryClient.invalidateQueries({ queryKey: ['salary-report'] })
    }
}

/** Провести строку документа на баланс. */
export function useAccrueLine(direction: SalesDirection, accrualId: string) {
    const invalidate = useInvalidateSalaryAccrualsData()

    return useMutation({
        mutationFn: (lineId: string) => api.accrueLine(direction, accrualId, lineId),
        onSuccess: invalidate,
    })
}

/** Отменить начисление строки (409, если документ уже PAID). */
export function useUnaccrueLine(direction: SalesDirection, accrualId: string) {
    const invalidate = useInvalidateSalaryAccrualsData()

    return useMutation({
        mutationFn: (lineId: string) => api.unaccrueLine(direction, accrualId, lineId),
        onSuccess: invalidate,
    })
}

/** Скорректировать сумму строки (только DRAFT, comment обязателен). */
export function useAdjustLine(direction: SalesDirection, accrualId: string) {
    const invalidate = useInvalidateSalaryAccrualsData()

    return useMutation({
        mutationFn: (payload: { lineId: string; amount: number; comment: string }) =>
            api.adjustLine(direction, accrualId, payload.lineId, {
                amount: payload.amount,
                comment: payload.comment,
            }),
        onSuccess: invalidate,
    })
}

/** Начислить весь документ построчно («Начислить всё» на карточке документа). */
export function useAccrueDocument(direction: SalesDirection) {
    const invalidate = useInvalidateSalaryAccrualsData()

    return useMutation({
        mutationFn: (accrualId: string) => api.accrueDocument(direction, accrualId),
        onSuccess: invalidate,
    })
}

/** Начислить все документы месяца направления («Начислить все документы месяца»). */
export function useAccruePeriod(direction: SalesDirection) {
    const invalidate = useInvalidateSalaryAccrualsData()

    return useMutation({
        mutationFn: (period: string) => api.accruePeriod(direction, period),
        onSuccess: invalidate,
    })
}
