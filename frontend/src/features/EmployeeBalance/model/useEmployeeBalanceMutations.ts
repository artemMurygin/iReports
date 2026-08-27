import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateBalanceTransactionRequest, CreatePayoutRequest, SalesDirection } from 'ireports-contracts'

import { BALANCE_SUMMARY_QUERY_KEY_PREFIX, DEPARTMENT_BALANCES_QUERY_KEY_PREFIX, EMPLOYEE_BALANCE_QUERY_KEY_PREFIX, api } from './api.ts'

/**
 * Мутации ручных движений баланса сотрудника (Фаза 7/10
 * docs/payroll-closing-and-accrual): создание и удаление. Обе после успеха
 * инвалидируют:
 * - ленту/остаток сотрудника (EMPLOYEE_BALANCE_QUERY_KEY_PREFIX);
 * - сводку по отделу (DEPARTMENT_BALANCES_QUERY_KEY_PREFIX) — движение
 *   меняет balance/accrued/advances/manual строки сотрудника в отделе. Сама
 *   `pages/DepartmentBalances` заменена `pages/EmployeeSettlements`
 *   (docs/employee-settlements-page-redesign, Фаза 3), но эндпоинт/ключ пока
 *   не удалены (см. WHY в `router.tsx`'s `payout` route) — инвалидация
 *   остаётся на случай, если что-то ещё читает этот ключ;
 * - сквозной список взаиморасчётов (BALANCE_SUMMARY_QUERY_KEY_PREFIX,
 *   `pages/EmployeeSettlements`, `/balance`) — та же причина, что и выше,
 *   для НОВОГО списка: без этого список показывал бы устаревший остаток
 *   после возврата с ленты сотрудника, где было создано/удалено движение;
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
        void queryClient.invalidateQueries({ queryKey: BALANCE_SUMMARY_QUERY_KEY_PREFIX })
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

/**
 * Инвалидация после мутаций выплаты (Фаза 6 docs/employee-settlements-page-redesign,
 * перенесено из бывшей `features/Payout/model/usePayoutMutations.ts`) — тот же
 * набор ключей, что `useInvalidateEmployeeBalanceData`, плюс `['salary-accruals']`:
 * выплата, закрывшая остаток, переводит документы начисления в PAID (см. WHY-
 * комментарии `markAccrualsPaidIfSettled` на бэкенде) — обычное ручное движение
 * этого не делает, поэтому только выплата инвалидирует этот ключ отдельно.
 */
function useInvalidatePayoutData() {
    const invalidateBalance = useInvalidateEmployeeBalanceData()
    const queryClient = useQueryClient()
    return () => {
        invalidateBalance()
        void queryClient.invalidateQueries({ queryKey: ['salary-accruals'] })
    }
}

/** Выплатить сотруднику (тип «Выплата» в `NewTransactionDrawer`). */
export function useCreatePayout(direction: SalesDirection) {
    const invalidate = useInvalidatePayoutData()

    return useMutation({
        mutationFn: (payload: CreatePayoutRequest) => api.createPayout(direction, payload),
        onSuccess: invalidate,
    })
}

/** Удалить выплату (кнопка «Удалить выплату» в ленте, `DeletePayoutDialog`). */
export function useDeletePayout(direction: SalesDirection) {
    const invalidate = useInvalidatePayoutData()

    return useMutation({
        mutationFn: (transactionId: string) => api.deletePayout(direction, transactionId),
        onSuccess: invalidate,
    })
}
