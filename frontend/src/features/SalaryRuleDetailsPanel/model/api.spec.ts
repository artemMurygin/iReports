import { describe, expect, it, vi, beforeEach } from 'vitest'

import { api as axiosInstance } from '@/shared/api/axios.instance.ts'

import { SALARY_RULE_DETAIL_QUERY_KEY_PREFIX, salaryRuleApi } from './api.ts'

vi.mock('@/shared/api/axios.instance.ts', () => ({
    api: { post: vi.fn() },
}))

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

// Soft-деактивация/восстановление ОДНОГО правила — `POST .../salary-rules/:ruleId/{deactivate,activate}`,
// URL резолвится по `direction` тем же способом, что и `salaryRuleApi.get`.
describe('salaryRuleApi.deactivate / salaryRuleApi.activate', () => {
    beforeEach(() => {
        vi.mocked(axiosInstance.post).mockReset()
    })

    it('deactivate вызывает POST /v1/{direction}/accounting/salary-rules/:ruleId/deactivate', async () => {
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: undefined })

        await salaryRuleApi.deactivate('service', 'rule-1')

        expect(axiosInstance.post).toHaveBeenCalledWith('/v1/service/accounting/salary-rules/rule-1/deactivate')
    })

    it('activate вызывает POST /v1/{direction}/accounting/salary-rules/:ruleId/activate для домена shop', async () => {
        vi.mocked(axiosInstance.post).mockResolvedValue({ data: undefined })

        await salaryRuleApi.activate('shop', 'rule-1')

        expect(axiosInstance.post).toHaveBeenCalledWith('/v1/shop/accounting/salary-rules/rule-1/activate')
    })

    it('оборачивает ошибку backend в ApiError с сообщением из тела ответа', async () => {
        vi.mocked(axiosInstance.post).mockRejectedValue({
            isAxiosError: true,
            response: { data: { message: 'Правило не найдено' } },
        })

        await expect(salaryRuleApi.deactivate('service', 'missing-rule')).rejects.toThrow('Правило не найдено')
    })
})
