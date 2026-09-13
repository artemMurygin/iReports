import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SalesDirection } from 'ireports-contracts'
import { toast } from 'sonner'

import { salaryRuleApi, SALARY_RULE_DETAIL_QUERY_KEY_PREFIX } from './api.ts'

/**
 * Soft-деактивация/восстановление ОДНОГО зарплатного правила из `SalaryRuleDetailsPanel` — панель
 * остаётся единственным местом в приложении, где неактивное правило вообще видно, поэтому
 * переключатель живёт в её `model/`, а не на странице редактирования схемы.
 *
 * По успеху инвалидирует и сам запрос правила (`salaryRuleApi.get`'s `queryKey`, тот же, что читает
 * `useSalaryRule`), и запрос мотивационной схемы — по префиксу `['motivation-schema']` (`useMotivationSchema`
 * (`useServiceSchemaEditForm.ts`)/`useShopSchemaEditForm.ts` формы редактирования схемы кладут в
 * кэш `['motivation-schema', direction, schemaId]`), а не по точному ключу: панель открывается из
 * карточки задачи и не знает `schemaId` правила напрямую (design.md решение 3 резолвит только
 * `taskId` -> правило, не схему).
 */
export function useSalaryRuleActivation(ruleId: string, direction: SalesDirection) {
    const queryClient = useQueryClient()

    function invalidate() {
        queryClient.invalidateQueries({ queryKey: [...SALARY_RULE_DETAIL_QUERY_KEY_PREFIX, direction, ruleId] })
        queryClient.invalidateQueries({ queryKey: ['motivation-schema'] })
    }

    const deactivateMutation = useMutation({
        mutationFn: () => salaryRuleApi.deactivate(direction, ruleId),
        onSuccess: () => {
            invalidate()
            toast.success('Правило деактивировано')
        },
        onError: (error) => {
            toast.error('Не удалось деактивировать правило', { description: error.message })
        },
    })

    const activateMutation = useMutation({
        mutationFn: () => salaryRuleApi.activate(direction, ruleId),
        onSuccess: () => {
            invalidate()
            toast.success('Правило активировано')
        },
        onError: (error) => {
            toast.error('Не удалось активировать правило', { description: error.message })
        },
    })

    return {
        deactivate: deactivateMutation.mutate,
        activate: activateMutation.mutate,
        isPending: deactivateMutation.isPending || activateMutation.isPending,
    }
}
