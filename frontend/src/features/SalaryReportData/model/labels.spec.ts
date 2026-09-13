import { describe, expect, it } from 'vitest'

import { getRoleLabel, getRuleTypeLabel, ROLE_LABELS } from './labels.ts'

/**
 * add-department-head-salary-rules — task group 17 (frontend labels for the 3 new rule types in
 * SalaryAccruals/SalaryReportData). `ROLE_LABELS` is `Record<TargetRole, string>`: `TargetRole`
 * (contracts/commands/salary-rule.ts) gained the `DEPARTMENT_HEAD` literal for FR1, so this map must
 * carry a Russian label for it too (same fix as the SOLO_MANAGER precedent, commit 9ab7786).
 *
 * `RULE_TYPE_LABELS`/`getRuleTypeLabel` already re-export `kernel/ruleTypeLabels.ts`'s
 * `ALL_RULE_TYPE_LABELS`, which already carries the 3 new rule types' Russian labels (added by task
 * group 14) — the tests below lock in that already-correct pass-through for the salary report.
 */
describe('ROLE_LABELS / getRoleLabel', () => {
    // FR1: новая роль «руководитель направления».
    it('has a Russian label for the new DEPARTMENT_HEAD role (FR1)', () => {
        expect(ROLE_LABELS.DEPARTMENT_HEAD).toBe('Руководитель направления')
        expect(getRoleLabel('DEPARTMENT_HEAD')).toBe('Руководитель направления')
    })
})

describe('getRuleTypeLabel for the 3 new department-level rule types', () => {
    // FR2: «% от факта отдела».
    it('resolves DepartmentPercent (FR2)', () => {
        expect(getRuleTypeLabel('DepartmentPercent')).toBe('% от факта отдела')
    })

    // FR3: «План продаж отдела».
    it('resolves DepartmentPlanBonus (FR3)', () => {
        expect(getRuleTypeLabel('DepartmentPlanBonus')).toBe('План продаж отдела')
    })

    // FR4: «План оборачиваемости склада».
    it('resolves DepartmentTurnoverBonus (FR4)', () => {
        expect(getRuleTypeLabel('DepartmentTurnoverBonus')).toBe('План оборачиваемости склада')
    })
})
