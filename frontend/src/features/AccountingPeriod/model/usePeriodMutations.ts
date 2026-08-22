import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SalesDirection } from 'ireports-contracts'

import { ACCOUNTING_PERIOD_QUERY_KEY_PREFIX, api } from './api.ts'

/**
 * Мутации закрытия/переоткрытия месяца. Обе после успеха инвалидируют:
 * - весь префикс фичи (статус периода + close-preview всех месяцев/направлений);
 * - план продаж (`['sales-plan']`) — закрытие пересчитало факт по свежим данным ERP,
 *   а PageHeader/таблица должны показать новое состояние;
 * - зарплатные отчёты (`['salary-report']`) — их ответ включает `isClosed` и статус
 *   документа начисления (см. ENDPOINTS.md, salary_report).
 * Ошибки мутаций НЕ оборачиваются в ApiError (см. комментарий в api.ts): диалоги
 * разбирают их через classifyClosePeriodError/classifyReopenPeriodError.
 */

function useInvalidatePeriodData() {
    const queryClient = useQueryClient()
    return () => {
        void queryClient.invalidateQueries({ queryKey: ACCOUNTING_PERIOD_QUERY_KEY_PREFIX })
        void queryClient.invalidateQueries({ queryKey: ['sales-plan'] })
        void queryClient.invalidateQueries({ queryKey: ['salary-report'] })
    }
}

export function useClosePeriod(direction: SalesDirection, period: string) {
    const invalidate = useInvalidatePeriodData()

    return useMutation({
        mutationFn: () => api.closePeriod(direction, period),
        onSuccess: invalidate,
    })
}

export function useReopenPeriod(direction: SalesDirection, period: string) {
    const invalidate = useInvalidatePeriodData()

    return useMutation({
        mutationFn: () => api.reopenPeriod(direction, period),
        onSuccess: invalidate,
    })
}
