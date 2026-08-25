import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreatePayoutRequest, PayoutBatchRequest, SalesDirection } from 'ireports-contracts'

import { PAYOUT_QUERY_KEY_PREFIX, api } from './api.ts'

/**
 * Мутации выплаты (Фаза 14 docs/payroll-closing-and-accrual): одиночная и пакетная. Обе после
 * успеха инвалидируют:
 * - страницу выплаты (PAYOUT_QUERY_KEY_PREFIX);
 * - ленту/остаток сотрудника и сводку по отделу (`['employee-balance']`/`['department-balances']`
 *   — ключи фичи `EmployeeBalance`, задублированы буквально, не импортированы: кросс-импорт
 *   между features запрещён линтингом, тот же приём, что HARDCODED_CREATED_BY выше);
 * - документы начисления (`['salary-accruals']`) — выплата, закрывшая остаток, переводит их
 *   в PAID (см. WHY-комментарии `markAccrualsPaidIfSettled` на бэкенде);
 * - `['salary-report']` — тот же приём, что useInvalidateEmployeeBalanceData/
 *   useInvalidateSalaryAccrualsData.
 */
export function useInvalidatePayoutData() {
    const queryClient = useQueryClient()
    return () => {
        void queryClient.invalidateQueries({ queryKey: PAYOUT_QUERY_KEY_PREFIX })
        void queryClient.invalidateQueries({ queryKey: ['employee-balance'] })
        void queryClient.invalidateQueries({ queryKey: ['department-balances'] })
        void queryClient.invalidateQueries({ queryKey: ['salary-accruals'] })
        void queryClient.invalidateQueries({ queryKey: ['salary-report'] })
    }
}

/** Выплатить одному сотруднику (`PayoutDrawer`). */
export function useCreatePayout(direction: SalesDirection) {
    const invalidate = useInvalidatePayoutData()

    return useMutation({
        mutationFn: (payload: CreatePayoutRequest) => api.createPayout(direction, payload),
        onSuccess: invalidate,
    })
}

/** Выплатить нескольким сотрудникам одним запросом (Selection Bar, «Выплатить выбранным»). */
export function useCreatePayoutBatch(direction: SalesDirection) {
    const invalidate = useInvalidatePayoutData()

    return useMutation({
        mutationFn: (payload: PayoutBatchRequest) => api.createPayoutBatch(direction, payload),
        onSuccess: invalidate,
    })
}

/** Удалить выплату (`DeletePayoutDialog`, Фаза 15 docs/payroll-closing-and-accrual, P3.3). */
export function useDeletePayout(direction: SalesDirection) {
    const invalidate = useInvalidatePayoutData()

    return useMutation({
        mutationFn: (transactionId: string) => api.deletePayout(direction, transactionId),
        onSuccess: invalidate,
    })
}
