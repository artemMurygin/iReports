import { describe, expect, it } from 'vitest'

import { SALARY_RULE_DETAIL_QUERY_KEY_PREFIX, salaryRuleApi } from './api.ts'

// add-task-salary-rule-links-comments, tasks.md группа 28 (28.1): `salaryRuleApi.get(direction,
// ruleId)` — query options factory для GET /v1/{direction}/accounting/salary-rules/:ruleId
// (architecture.md, HTTP-эндпоинты: `GetSalaryRuleHttpController`). По прецеденту
// `TaskStatusControl/model/api.spec.ts` — проверяем только queryKey (стабильность/различение по
// ruleId и по direction, чтобы панель правила service и панель правила shop с одним и тем же
// ruleId никогда не путали кэш), сетевой запрос проверяет `useSalaryRule.spec.tsx`.
describe('salaryRuleApi.get queryKey', () => {
    it('is prefixed by SALARY_RULE_DETAIL_QUERY_KEY_PREFIX', () => {
        const { queryKey } = salaryRuleApi.get('service', 'rule-1')
        expect(queryKey.slice(0, SALARY_RULE_DETAIL_QUERY_KEY_PREFIX.length)).toEqual([
            ...SALARY_RULE_DETAIL_QUERY_KEY_PREFIX,
        ])
    })

    it('differs between two different rule ids (no cross-rule cache collision)', () => {
        const first = salaryRuleApi.get('service', 'rule-1').queryKey
        const second = salaryRuleApi.get('service', 'rule-2').queryKey
        expect(first).not.toEqual(second)
    })

    it('differs between service and shop for the same rule id (no cross-direction cache collision)', () => {
        const first = salaryRuleApi.get('service', 'rule-1').queryKey
        const second = salaryRuleApi.get('shop', 'rule-1').queryKey
        expect(first).not.toEqual(second)
    })

    it('is stable for the same direction and rule id', () => {
        const first = salaryRuleApi.get('service', 'rule-1').queryKey
        const second = salaryRuleApi.get('service', 'rule-1').queryKey
        expect(first).toEqual(second)
    })
})
