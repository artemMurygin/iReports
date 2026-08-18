import { useQuery } from '@tanstack/react-query'

import { api } from './api.ts'

/** Типы зарплатных правил сервиса + допустимые роли по типу (`GET .../salary_role_types`). С Фазы 3
 * Шаг 2 поддерживает все 4 типа (см. `SalaryRulesRuleFormCard.tsx`) — `SalaryRulesPage` строит из
 * ответа map `RuleType → allowedRoles[]` для селекта роли, а не читает одну фиксированную запись. */
export function useSalaryRuleTypes() {
    return useQuery(api.getSalaryRuleTypes())
}
