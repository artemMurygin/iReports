import { useMemo } from 'react'
import type { SalaryRuleTypesResponse, TargetRole } from 'ireports-contracts'

import type { RuleType } from './ruleDraft.ts'

/**
 * Ответ `salary_role_types` → map `RuleType → allowedRoles[]` для селекта роли в карточке правила
 * (с Фазы 3 Шаг 2 поддерживает все типы, а не одну фиксированную запись).
 *
 * Живёт в ядре, потому что ничего не знает про то, чей это ответ: оба эндпоинта
 * (`/v1/service/accounting/salary_role_types` и `/v1/shop/accounting/salary_role_types`) отдают одну
 * и ту же форму `SalaryRuleTypesResponse` (см. `shop/model/useShopSalaryRuleTypes.ts`), поэтому оба
 * адаптера зовут этот хук вместо собственной копии одного и того же цикла.
 */
export function useAllowedRolesByType(
    entries: SalaryRuleTypesResponse | undefined,
): Partial<Record<RuleType, TargetRole[]>> {
    return useMemo(() => {
        const map: Partial<Record<RuleType, TargetRole[]>> = {}
        for (const entry of entries ?? []) {
            map[entry.type as RuleType] = entry.allowedRoles
        }
        return map
    }, [entries])
}
