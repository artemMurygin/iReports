import { describe, expect, it } from 'vitest'
import type { SalaryAccrualLine } from 'ireports-contracts'

import { formatLineBasisNote, formatLineMeta } from './accrualView.ts'
import { ROLE_LABEL } from './labels.ts'

/**
 * add-department-head-salary-rules — task group 17 (frontend labels for the 3 new rule types in
 * SalaryAccruals/SalaryReportData). `ROLE_LABEL` is `Record<TargetRole, string>`: `TargetRole`
 * (contracts/commands/salary-rule.ts) gained the `DEPARTMENT_HEAD` literal for FR1, so this map must
 * carry a Russian label for it too (same fix as the SOLO_MANAGER precedent, commit 9ab7786).
 *
 * `DepartmentPercent`/`DepartmentPlanBonus`/`DepartmentTurnoverBonus` (FR2-FR4) themselves need no
 * new entry in this file's own maps: `kernel/ruleTypeLabels.ts`'s `ALL_RULE_TYPE_LABELS` already
 * carries their Russian labels (added by task group 14), and `formatLineMeta`
 * (`model/accrualView.ts`) reads that kernel map directly — the same mechanism already used for the
 * pre-existing `TaskCompletion` type, which needed no `SalaryAccruals/model/labels.ts` change either
 * (commit 302dc77 touched only `TASK_STATUS_LABEL`/`SOURCE_TYPE_LABEL`, not a rule-type map). The 3
 * new department-level rules never carry `sources`/`quantity` (`DepartmentPercentEntity.calculate()`
 * et al. always return `sources: []`, no `quantity` — there is no per-transaction countable unit at
 * department level), so `RULE_UNIT_FORMS`/`RULE_UNIT_PLURAL_LABEL` intentionally get no entries for
 * them either, matching `TaskCompletion`'s precedent — the tests below lock in that already-correct
 * fallback behaviour for accrual-line display.
 */

function line(overrides: Partial<SalaryAccrualLine> = {}): SalaryAccrualLine {
    return {
        id: 'l1',
        ruleId: 'r1',
        type: 'OrderPayed',
        name: 'Ремонт · процент от работ',
        targetRole: 'ENGINEER',
        amount: 24_800,
        originalAmount: 24_800,
        status: 'DRAFT',
        sources: [],
        adjustmentComment: null,
        comment: null,
        requiresManualInput: false,
        ...overrides,
    }
}

describe('ROLE_LABEL', () => {
    // FR1: новая роль «руководитель направления» — targetRole правила/строки начисления.
    it('has a Russian label for the new DEPARTMENT_HEAD role (FR1)', () => {
        expect(ROLE_LABEL.DEPARTMENT_HEAD).toBe('Руководитель направления')
    })
})

describe('formatLineMeta for the 3 new department-level rule types', () => {
    // FR2: «% от факта отдела».
    it('renders the correct type label for DepartmentPercent (FR2)', () => {
        expect(formatLineMeta(line({ type: 'DepartmentPercent', targetRole: 'DEPARTMENT_HEAD' }))).toBe(
            '% от факта отдела',
        )
    })

    // FR3: «План продаж отдела».
    it('renders the correct type label for DepartmentPlanBonus (FR3)', () => {
        expect(formatLineMeta(line({ type: 'DepartmentPlanBonus', targetRole: 'DEPARTMENT_HEAD' }))).toBe(
            'План продаж отдела',
        )
    })

    // FR4: «План оборачиваемости склада».
    it('renders the correct type label for DepartmentTurnoverBonus (FR4)', () => {
        expect(
            formatLineMeta(line({ type: 'DepartmentTurnoverBonus', targetRole: 'DEPARTMENT_HEAD' })),
        ).toBe('План оборачиваемости склада')
    })
})

describe('formatLineBasisNote for the 3 new department-level rule types', () => {
    // FR2-FR4: без `quantity` (нет измеримой транзакционной базы на уровне отдела) — «фикс за
    // период», как у остальных немерных правил (например, DepartmentPlanBonus's bonus).
    it.each(['DepartmentPercent', 'DepartmentPlanBonus', 'DepartmentTurnoverBonus'] as const)(
        'falls back to "фикс за период" for %s (no quantity)',
        (type) => {
            expect(formatLineBasisNote(line({ type }))).toBe('фикс за период')
        },
    )
})
