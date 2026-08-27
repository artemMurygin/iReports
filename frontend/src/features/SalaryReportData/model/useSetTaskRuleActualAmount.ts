import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SetTaskRuleActualAmountRequest } from 'ireports-contracts'

import { api } from './api.ts'

/**
 * Мутация ручного ввода фактической суммы по закрытой задаче (`api.setTaskRuleActualAmount`,
 * см. её комментарий) — тот же приём, что `features/SalaryAccruals/model/useAccrualMutations.ts`:
 * успех инвалидирует весь префикс `['salary-report']` (оба режима отчёта — сотрудника и отдела —
 * читают одну и ту же сумму правила), а не только текущий запрошенный отчёт.
 */
export function useSetTaskRuleActualAmount() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (body: SetTaskRuleActualAmountRequest) => api.setTaskRuleActualAmount(body),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['salary-report'] })
        },
    })
}
