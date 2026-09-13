import type { TargetRole } from 'ireports-contracts'

import type { SalaryDirection, SalaryReportRule } from '@/features/SalaryReportData'

/**
 * Канонический порядок ролей по направлению — зеркалит порядок `ALL_SERVICE_ROLES`/`ALL_SHOP_ROLES`
 * в бэкендовых `salary-rule-role-catalog.ts` (`domains/service`/`domains/shop`,
 * `modules/accounting/domain/services/`), чтобы группы ролей в отчёте шли в том же порядке, что и
 * список ролей в форме правила, а не в порядке появления правил в ответе.
 */
const ROLE_ORDER: Record<SalaryDirection, TargetRole[]> = {
    service: ['ENGINEER', 'ONLINE_MANAGER', 'OFFLINE_MANAGER', 'ORDER_MANAGER'],
    shop: ['ONLINE_MANAGER', 'OFFLINE_MANAGER', 'ONLINE_PURCHASER', 'OFFLINE_PURCHASER'],
}

export type RuleRoleGroup = {
    role: TargetRole
    rules: SalaryReportRule[]
}

/**
 * Группирует правила направления по `rule.targetRole` — вместо плоского списка правил под
 * заголовком направления (`DirectionSourceCard`). Порядок групп — канонический `ROLE_ORDER`
 * направления, не порядок появления в `rules[]`; роль без единого правила у сотрудника в группу не
 * попадает. Правило с ролью вне `ROLE_ORDER` направления (не должно случаться при консистентных
 * данных, например `OFFICE`/`SOLO_MANAGER` — роли графика работы, не зарплатных правил) уходит в
 * хвостовые группы в порядке появления, а не отбрасывается молча.
 */
export function groupRulesByRole(rules: SalaryReportRule[], direction: SalaryDirection): RuleRoleGroup[] {
    const byRole = new Map<TargetRole, SalaryReportRule[]>()
    for (const rule of rules) {
        const roleRules = byRole.get(rule.targetRole)
        if (roleRules) roleRules.push(rule)
        else byRole.set(rule.targetRole, [rule])
    }

    const groups: RuleRoleGroup[] = []
    for (const role of ROLE_ORDER[direction]) {
        const roleRules = byRole.get(role)
        if (roleRules !== undefined) {
            groups.push({ role, rules: roleRules })
            byRole.delete(role)
        }
    }
    for (const [role, roleRules] of byRole) {
        groups.push({ role, rules: roleRules })
    }
    return groups
}
