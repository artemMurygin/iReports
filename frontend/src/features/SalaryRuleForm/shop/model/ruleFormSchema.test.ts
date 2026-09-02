import { describe, expect, it } from 'vitest'

import { createRuleDraft, defaultBorders, type RuleDraft } from '../../model/ruleDraft.ts'
import { resolveShopRuleDraft } from './ruleFormSchema.ts'

/**
 * Shop mirror of `service/model/ruleFormSchema.test.ts` (Фаза 4, docs/salary-schema-creation-ui) — `PayPerHour`
 * and the shared `percentBorders`/award boundary classes are covered there already (this resolver
 * reuses the same award builders for `ProductSold`/`TaskCompleted`, see `shop/model/ruleFormSchema.ts`'s
 * file comment), so this file focuses on what's actually different for shop:
 * `category`/`ProductSold`/`UsedProductSold`'s narrower award set (no `FloatPercent`), and that the
 * output is `ShopSalaryRuleRequest`, never mixed with the service `SalaryRuleRequest` shape.
 */

function baseDraft(overrides: Partial<RuleDraft> = {}): RuleDraft {
    return { ...createRuleDraft(), name: 'Тестовое правило магазина', targetRole: 'OFFLINE_MANAGER', ...overrides }
}

describe('resolveShopRuleDraft — PayPerHour', () => {
    it('succeeds with a valid rate', () => {
        const result = resolveShopRuleDraft(baseDraft({ type: 'PayPerHour', price: '380' }))
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data).toEqual({
                type: 'PayPerHour',
                name: 'Тестовое правило магазина',
                targetRole: 'OFFLINE_MANAGER',
                config: { price: 380 },
            })
        }
    })

    it('fails when the rate is missing', () => {
        const result = resolveShopRuleDraft(baseDraft({ type: 'PayPerHour', price: '' }))
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.price).toBeTruthy()
    })
})

describe('resolveShopRuleDraft — ProductSold', () => {
    it('category null (Все категории) is a valid default, not a validation error', () => {
        const result = resolveShopRuleDraft(
            baseDraft({ type: 'ProductSold', awardKind: 'Fixed', price: '300', category: null }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'ProductSold') {
            expect(result.data.config.category).toBeNull()
        }
    })

    it('carries a specific category id through', () => {
        const result = resolveShopRuleDraft(
            baseDraft({ type: 'ProductSold', awardKind: 'Fixed', price: '300', category: 'accessories-id' }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'ProductSold') {
            expect(result.data.config.category).toBe('accessories-id')
        }
    })

    it('FloatPercent succeeds with exactly 3 valid percentBorders and a shop salaryBasis', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'ProductSold',
                awardKind: 'FloatPercent',
                basePercent: '4',
                salaryBasis: 'MARGIN',
                percentBorders: defaultBorders(),
                category: null,
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'ProductSold' && result.data.config.award.type === 'FloatPercent') {
            expect(result.data.config.award.percentBorders).toHaveLength(3)
            expect(result.data.config.award.salaryBasis).toBe('MARGIN')
        }
    })

    it('FloatPercent fails with only 2 percentBorders', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'ProductSold',
                awardKind: 'FloatPercent',
                basePercent: '4',
                salaryBasis: 'MARGIN',
                percentBorders: defaultBorders().slice(0, 2),
                category: null,
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.thresholds).toContain('2')
    })
})

describe('resolveShopRuleDraft — UsedProductSold has no FloatPercent', () => {
    it('rejects FloatPercent — only Fixed/FixedPercent exist for this type', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'UsedProductSold',
                targetRole: 'OFFLINE_PURCHASER',
                awardKind: 'FloatPercent' as never,
                category: null,
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.awardKind).toBeTruthy()
    })

    it('FixedPercent succeeds with percent + salaryBasis', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'UsedProductSold',
                targetRole: 'OFFLINE_PURCHASER',
                awardKind: 'FixedPercent',
                percent: '6',
                salaryBasis: 'MARGIN',
                category: null,
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'UsedProductSold') {
            expect(result.data.config.award).toEqual({ type: 'FixedPercent', percent: 6, salaryBasis: 'MARGIN' })
        }
    })
})

describe('resolveShopRuleDraft — TaskCompleted (change salary-rule-bitrix-task, no category, no award-union)', () => {
    function taskDraft(overrides: Partial<RuleDraft> = {}): RuleDraft {
        return baseDraft({
            type: 'TaskCompleted',
            description: 'Провести инвентаризацию склада',
            period: '2026-08',
            isRecurring: false,
            dueDate: '2026-08-15',
            price: '10000',
            ...overrides,
        })
    }

    it('succeeds with all required fields, no category and no award-union in the payload', () => {
        const result = resolveShopRuleDraft(taskDraft())
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompleted') {
            expect('category' in result.data.config).toBe(false)
            expect('award' in result.data.config).toBe(false)
            expect(result.data.config.rewardAmount).toBe(10000)
        }
    })

    it('rejects a due date outside the selected period', () => {
        const result = resolveShopRuleDraft(taskDraft({ period: '2026-08', dueDate: '2026-09-01' }))
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.dueDate).toBeTruthy()
    })
})
