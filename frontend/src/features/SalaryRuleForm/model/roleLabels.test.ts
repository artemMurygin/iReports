import { describe, expect, it } from 'vitest'

import { ROLE_LABELS } from './roleLabels.ts'

/**
 * add-department-head-salary-rules, FR1 — «руководитель направления» is a new `targetRole` literal
 * added to the shared `targetRoleSchema` (`contracts/commands/salary-rule.ts`); `ROLE_LABELS` must
 * carry a Russian label for it so the role selector (`RuleRoleField.tsx`) and the rule row summary
 * (`RuleRow.tsx`) can render it like any other role.
 */
describe('ROLE_LABELS', () => {
    it('has a Russian label for the new DEPARTMENT_HEAD role (FR1)', () => {
        expect(ROLE_LABELS.DEPARTMENT_HEAD).toBe('Руководитель направления')
    })
})
