import { describe, expect, it } from 'vitest'

import { createRuleDraft, defaultBorders, type RuleDraft } from '../../model/ruleDraft.ts'
import { draftFromShopRule, resolveShopRuleDraft } from './ruleFormSchema.ts'

/**
 * Shop mirror of `service/model/ruleFormSchema.test.ts` (Фаза 4, docs/salary-schema-creation-ui) — `PayPerHour`
 * and the shared `percentBorders`/award boundary classes are covered there already (this resolver
 * reuses the same award builder for `ProductSold`, see `shop/model/ruleFormSchema.ts`'s file
 * comment), so this file focuses on what's actually different for shop:
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

/**
 * `TaskCompletion` (tasks.md раздел 21, зеркало раздела 20 для направления `shop`, node `ZMEof`) —
 * та же независимая копия схемы, что и `taskCompletionShopSalaryConfigSchema`
 * (`contracts/commands/shop-salary-rule.ts`, issue #57) — только `type`/`config`-форма совпадает
 * побайтово с сервисной, сам резолвер и его тесты остаются раздельными. См.
 * `service/model/ruleFormSchema.test.ts`'s аналогичный `describe` — те же сценарии, другой
 * `targetRole`-справочник (`OFFLINE_MANAGER` вместо `ENGINEER`, tasks.md раздел 21: "различается
 * только targetRole-справочник").
 */
describe('resolveShopRuleDraft — TaskCompletion', () => {
    it('builds bitrixTaskTitle from the rule name and carries the task fields through', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'TaskCompletion',
                name: 'Провести ревизию склада',
                taskDescription: 'Сверить остатки по накладным',
                isRecurring: true,
                deadlineTemplate: '2026-09-25',
                price: '5000',
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion') {
            expect(result.data.config).toEqual({
                bitrixTaskTitle: 'Провести ревизию склада',
                taskDescription: 'Сверить остатки по накладным',
                isRecurring: true,
                deadlineTemplate: '2026-09-25',
                defaultAmount: 5000,
            })
        }
    })

    it('omits taskDescription entirely when left blank (optional in the contract)', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'TaskCompletion',
                deadlineTemplate: '2026-09-25',
                taskDescription: '   ',
                price: '5000',
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion') {
            expect('taskDescription' in result.data.config).toBe(false)
        }
    })

    it('fails when the deadline is missing', () => {
        const result = resolveShopRuleDraft(
            baseDraft({ type: 'TaskCompletion', deadlineTemplate: '', price: '5000' }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.dueDate).toBeTruthy()
    })

    it('fails when the default amount is missing', () => {
        const result = resolveShopRuleDraft(
            baseDraft({ type: 'TaskCompletion', deadlineTemplate: '2026-09-25', price: '' }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.price).toBeTruthy()
    })

    it('defaults isRecurring to false for a one-off task', () => {
        const result = resolveShopRuleDraft(
            baseDraft({ type: 'TaskCompletion', deadlineTemplate: '2026-09-25', isRecurring: false, price: '5000' }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion') {
            expect(result.data.config.isRecurring).toBe(false)
        }
    })
})

describe('draftFromShopRule — TaskCompletion', () => {
    it('round-trips a persisted rule back into a draft usable by resolveShopRuleDraft', () => {
        const created = resolveShopRuleDraft(
            baseDraft({
                type: 'TaskCompletion',
                name: 'Провести ревизию склада',
                taskDescription: 'Сверить остатки по накладным',
                isRecurring: false,
                deadlineTemplate: '2026-09-25',
                price: '5000',
            }),
        )
        expect(created.success).toBe(true)
        if (!created.success) return

        const draft = draftFromShopRule({ ...created.data, id: 'shop-rule-1' })
        expect(draft.type).toBe('TaskCompletion')
        expect(draft.name).toBe('Провести ревизию склада')
        expect(draft.taskDescription).toBe('Сверить остатки по накладным')
        expect(draft.isRecurring).toBe(false)
        expect(draft.deadlineTemplate).toBe('2026-09-25')
        expect(draft.price).toBe('5000')

        const resolvedAgain = resolveShopRuleDraft(draft)
        expect(resolvedAgain.success).toBe(true)
        if (resolvedAgain.success && resolvedAgain.data.type === 'TaskCompletion') {
            expect(resolvedAgain.data.config.taskDescription).toBe('Сверить остатки по накладным')
            expect(resolvedAgain.data.config.defaultAmount).toBe(5000)
        }
    })

    it('defaults taskDescription to an empty string when the persisted rule has none', () => {
        const draft = draftFromShopRule({
            id: 'shop-rule-2',
            type: 'TaskCompletion',
            name: 'Проверка витрины',
            targetRole: 'OFFLINE_MANAGER',
            config: {
                bitrixTaskTitle: 'Проверка витрины',
                isRecurring: true,
                deadlineTemplate: '2026-09-05',
                defaultAmount: 3000,
            },
        })
        expect(draft.taskDescription).toBe('')
        expect(draft.isRecurring).toBe(true)
        expect(draft.deadlineTemplate).toBe('2026-09-05')
        expect(draft.price).toBe('3000')
    })
})
