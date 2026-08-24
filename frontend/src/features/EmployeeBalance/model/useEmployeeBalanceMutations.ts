import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateBalanceTransactionRequest } from 'ireports-contracts'

import { DEPARTMENT_BALANCES_QUERY_KEY_PREFIX, EMPLOYEE_BALANCE_QUERY_KEY_PREFIX, api } from './api.ts'

/**
 * Мутации ручных движений баланса сотрудника (Фаза 7/10
 * docs/payroll-closing-and-accrual): создание и удаление. Обе после успеха
 * инвалидируют:
 * - ленту/остаток сотрудника (EMPLOYEE_BALANCE_QUERY_KEY_PREFIX);
 * - сводку по отделу (DEPARTMENT_BALANCES_QUERY_KEY_PREFIX) — движение
 *   меняет balance/accrued/advances/manual строки сотрудника в отделе;
 * - `['salary-report']` — отчёт по зарплате сотрудника/отдела читает те же
 *   остатки (тот же приём, что useInvalidateSalaryAccrualsData в
 *   features/SalaryAccruals/model/useAccrualMutations.ts).
 * Ошибки мутаций НЕ оборачиваются в ApiError (см. api.ts) — UI читает сырой
 * AxiosError для текста ошибки сервера (400/409).
 */

export function useInvalidateEmployeeBalanceData() {
    const queryClient = useQueryClient()
    return () => {
        void queryClient.invalidateQueries({ queryKey: EMPLOYEE_BALANCE_QUERY_KEY_PREFIX })
        void queryClient.invalidateQueries({ queryKey: DEPARTMENT_BALANCES_QUERY_KEY_PREFIX })
        void queryClient.invalidateQueries({ queryKey: ['salary-report'] })
    }
}

/** Создать ручное движение баланса сотрудника (drawer «Добавить движение»). */
export function useCreateTransaction(employeeId: number) {
    const invalidate = useInvalidateEmployeeBalanceData()

    return useMutation({
        mutationFn: (payload: CreateBalanceTransactionRequest) => api.createTransaction(employeeId, payload),
        onSuccess: invalidate,
    })
}

/** Удалить ручное движение без документа ERP (кнопка «Удалить» в ленте). */
export function useDeleteTransaction() {
    const invalidate = useInvalidateEmployeeBalanceData()

    return useMutation({
        mutationFn: (transactionId: string) => api.deleteTransaction(transactionId),
        onSuccess: invalidate,
    })
}
