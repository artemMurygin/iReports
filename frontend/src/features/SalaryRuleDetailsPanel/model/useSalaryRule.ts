import { useQuery } from '@tanstack/react-query'
import type { SalesDirection } from 'ireports-contracts'

import { salaryRuleApi } from './api.ts'

/**
 * add-task-salary-rule-links-comments, tasks.md группа 28 — read-only данные для
 * `SalaryRuleDetailsPanel` (architecture.md, Hooks: `useSalaryRule(ruleId, direction)`). Тонкая
 * обёртка над `useQuery`, как `TaskStatusControl/model/useTask.ts`; ошибки приходят уже как
 * `ApiError` из `salaryRuleApi.get`.
 */
export function useSalaryRule(ruleId: string, direction: SalesDirection) {
    const { data, isLoading, error } = useQuery(salaryRuleApi.get(direction, ruleId))

    return { rule: data, isLoading, error }
}
