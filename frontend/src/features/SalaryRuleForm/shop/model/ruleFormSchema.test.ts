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
 * replace-bitrix-task-integration, раздел 14 tasks.md (14.5) — зеркало
 * `service/model/ruleFormSchema.test.ts`'s аналогичный `describe` (другой `targetRole`-справочник,
 * `OFFLINE_MANAGER` вместо `ENGINEER`), см. его комментарий про смысл каждого сценария.
 */
describe('resolveShopRuleDraft — TaskCompletion', () => {
    it('carries the already-created taskId and the recurrence template fields through', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'TaskCompletion',
                name: 'Провести ревизию склада',
                taskId: 'task-1',
                taskTitleTemplate: 'Провести ревизию склада ({месяц})',
                taskDescriptionTemplate: 'Сверить остатки по накладным',
                isRecurring: true,
                deadlineTemplate: '2026-09-25',
                price: '5000',
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion') {
            expect(result.data.config).toEqual({
                taskId: 'task-1',
                taskTitleTemplate: 'Провести ревизию склада ({месяц})',
                taskDescriptionTemplate: 'Сверить остатки по накладным',
                isRecurring: true,
                deadlineTemplate: '2026-09-25',
                defaultAmount: 5000,
                taskLinkTemplates: [],
            })
        }
    })

    // add-task-rule-task-lifecycle
    it('carries taskLinkTemplates through unchanged', () => {
        const linkTemplates = [{ url: 'https://example.com/1', label: 'Отчёт' }]
        const result = resolveShopRuleDraft(
            baseDraft({ type: 'TaskCompletion', taskId: 'task-1', price: '5000', taskLinkTemplates: linkTemplates }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion') {
            expect(result.data.config.taskLinkTemplates).toEqual(linkTemplates)
        }
    })

    it('omits taskDescriptionTemplate entirely when left blank (optional in the contract)', () => {
        const result = resolveShopRuleDraft(
            baseDraft({ type: 'TaskCompletion', taskId: 'task-1', isRecurring: false, price: '5000' }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion') {
            expect('taskDescriptionTemplate' in result.data.config).toBe(false)
        }
    })

    it('fails when the task was never created on Step 1 (empty taskId — regression guard)', () => {
        const result = resolveShopRuleDraft(baseDraft({ type: 'TaskCompletion', taskId: '', price: '5000' }))
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.taskId).toBeTruthy()
    })

    it('fails when the default amount is missing', () => {
        const result = resolveShopRuleDraft(baseDraft({ type: 'TaskCompletion', taskId: 'task-1', price: '' }))
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.price).toBeTruthy()
    })

    it('requires the template title/deadline only for a recurring rule', () => {
        const notRecurring = resolveShopRuleDraft(
            baseDraft({ type: 'TaskCompletion', taskId: 'task-1', isRecurring: false, price: '5000' }),
        )
        expect(notRecurring.success).toBe(true)

        const recurring = resolveShopRuleDraft(
            baseDraft({ type: 'TaskCompletion', taskId: 'task-1', isRecurring: true, price: '5000' }),
        )
        expect(recurring.success).toBe(false)
        if (!recurring.success) {
            expect(recurring.errors.taskTitleTemplate).toBeTruthy()
            expect(recurring.errors.dueDate).toBeTruthy()
        }
    })
})

describe('draftFromShopRule — TaskCompletion', () => {
    it('round-trips a persisted rule back into a draft usable by resolveShopRuleDraft', () => {
        const draft = draftFromShopRule({
            id: 'shop-rule-1',
            type: 'TaskCompletion',
            name: 'Провести ревизию склада',
            targetRole: 'OFFLINE_MANAGER',
            isActive: true,
            config: {
                taskTitleTemplate: 'Провести ревизию склада ({месяц})',
                taskDescriptionTemplate: 'Сверить остатки по накладным',
                isRecurring: false,
                deadlineTemplate: '2026-09-25',
                defaultAmount: 5000,
                taskIdByPeriod: { '2026-09': 'task-1' },
            },
        })
        expect(draft.type).toBe('TaskCompletion')
        expect(draft.name).toBe('Провести ревизию склада')
        expect(draft.taskId).toBe('task-1')
        expect(draft.taskDescriptionTemplate).toBe('Сверить остатки по накладным')
        expect(draft.isRecurring).toBe(false)
        expect(draft.deadlineTemplate).toBe('2026-09-25')
        expect(draft.price).toBe('5000')
        expect(draft.taskLinkTemplates).toEqual([])

        const resolvedAgain = resolveShopRuleDraft(draft)
        expect(resolvedAgain.success).toBe(true)
        if (resolvedAgain.success && resolvedAgain.data.type === 'TaskCompletion') {
            expect(resolvedAgain.data.config.taskId).toBe('task-1')
            expect(resolvedAgain.data.config.taskDescriptionTemplate).toBe('Сверить остатки по накладным')
            expect(resolvedAgain.data.config.defaultAmount).toBe(5000)
        }
    })

    // add-task-rule-task-lifecycle
    it('round-trips taskLinkTemplates when the response carries them', () => {
        const draft = draftFromShopRule({
            id: 'shop-rule-1',
            type: 'TaskCompletion',
            name: 'Провести ревизию склада',
            targetRole: 'OFFLINE_MANAGER',
            isActive: true,
            config: {
                taskTitleTemplate: 'Провести ревизию склада',
                isRecurring: true,
                deadlineTemplate: '2026-09-25',
                defaultAmount: 5000,
                taskIdByPeriod: { '2026-09': 'task-1' },
                taskLinkTemplates: [{ url: 'https://example.com/1', label: 'Отчёт' }],
            },
        })
        expect(draft.taskLinkTemplates).toEqual([{ url: 'https://example.com/1', label: 'Отчёт' }])
    })

    it('defaults taskDescriptionTemplate to an empty string and taskId to "" when the map is empty', () => {
        const draft = draftFromShopRule({
            id: 'shop-rule-2',
            type: 'TaskCompletion',
            name: 'Проверка витрины',
            targetRole: 'OFFLINE_MANAGER',
            isActive: true,
            config: {
                taskTitleTemplate: '',
                isRecurring: true,
                deadlineTemplate: '2026-09-05',
                defaultAmount: 3000,
                taskIdByPeriod: {},
            },
        })
        expect(draft.taskId).toBe('')
        expect(draft.taskDescriptionTemplate).toBe('')
        expect(draft.isRecurring).toBe(true)
        expect(draft.deadlineTemplate).toBe('2026-09-05')
        expect(draft.price).toBe('3000')
    })
})

/**
 * add-department-head-salary-rules, FR2-FR4 — shop mirror of `service/model/ruleFormSchema.test.ts`'s
 * analogous `describe`s: same 3 config shapes (design.md — new rule types apply identically to both
 * directions), except `salaryBasis` is drawn from the narrower `shopSalaryBasisSchema`
 * (`REVENUE`/`MARGIN` only — no `SALARY_MINUS_ENGINEER_SALARY`, shop has no engineer role) and
 * `DepartmentTurnoverBonus.config.warehouseId` is a MoySklad UUID `string`, not a RoApp `number`.
 */
describe('resolveShopRuleDraft — DepartmentPercent (FR2)', () => {
    it('succeeds with salaryBasis, category null and percent', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'DepartmentPercent',
                targetRole: 'DEPARTMENT_HEAD',
                salaryBasis: 'MARGIN',
                category: null,
                percent: '5',
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'DepartmentPercent') {
            expect(result.data.config).toEqual({ salaryBasis: 'MARGIN', category: null, percent: 5 })
        }
    })

    it('fails when percent is missing', () => {
        const result = resolveShopRuleDraft(
            baseDraft({ type: 'DepartmentPercent', targetRole: 'DEPARTMENT_HEAD', salaryBasis: 'REVENUE', percent: '' }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.percent).toBeTruthy()
    })
})

describe('resolveShopRuleDraft — DepartmentPlanBonus (FR3)', () => {
    it('succeeds with a fixed amount and exactly 3 valid percentBorders', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'DepartmentPlanBonus',
                targetRole: 'DEPARTMENT_HEAD',
                salaryBasis: 'REVENUE',
                category: null,
                price: '10000',
                percentBorders: defaultBorders(),
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'DepartmentPlanBonus') {
            expect(result.data.config.fixedAmount).toBe(10000)
            expect(result.data.config.percentBorders).toHaveLength(3)
        }
    })

    it('fails with only 2 percentBorders', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'DepartmentPlanBonus',
                targetRole: 'DEPARTMENT_HEAD',
                salaryBasis: 'REVENUE',
                price: '10000',
                percentBorders: defaultBorders().slice(0, 2),
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.thresholds).toContain('2')
    })
})

describe('resolveShopRuleDraft — DepartmentTurnoverBonus (FR4)', () => {
    it('succeeds with a string warehouseId (MoySklad UUID), plan ratio and exactly 3 percentBorders', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'DepartmentTurnoverBonus',
                targetRole: 'DEPARTMENT_HEAD',
                warehouseId: 'wh-uuid-1',
                category: null,
                price: '15000',
                planTurnoverRatio: '1.2',
                percentBorders: defaultBorders(),
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'DepartmentTurnoverBonus') {
            expect(result.data.config.warehouseId).toBe('wh-uuid-1')
            expect(result.data.config.fixedAmount).toBe(15000)
            expect(result.data.config.planTurnoverRatio).toBe(1.2)
        }
    })

    it('fails when the warehouse is not selected', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'DepartmentTurnoverBonus',
                targetRole: 'DEPARTMENT_HEAD',
                warehouseId: '',
                price: '15000',
                planTurnoverRatio: '1.2',
                percentBorders: defaultBorders(),
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.warehouseId).toBeTruthy()
    })

    it('fails when the plan turnover ratio is missing', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'DepartmentTurnoverBonus',
                targetRole: 'DEPARTMENT_HEAD',
                warehouseId: 'wh-uuid-1',
                price: '15000',
                planTurnoverRatio: '',
                percentBorders: defaultBorders(),
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.planTurnoverRatio).toBeTruthy()
    })
})

describe('draftFromShopRule — department-level rule types round-trip (FR2-FR4)', () => {
    it('DepartmentTurnoverBonus keeps warehouseId as a string', () => {
        const draft = draftFromShopRule({
            id: 'shop-rule-dep-1',
            type: 'DepartmentTurnoverBonus',
            name: 'Премия за оборачиваемость магазина',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                warehouseId: 'wh-uuid-1',
                category: null,
                fixedAmount: 15000,
                planTurnoverRatio: 1.2,
                percentBorders: [
                    { name: 'Ниже плана', fromPlanPercent: 0, multiplier: 0.5, mode: 'FIX' },
                    { name: 'Выполнение плана', fromPlanPercent: 70, multiplier: 1, mode: 'LINEAR' },
                    { name: 'Перевыполнение', fromPlanPercent: 120, multiplier: 1.2, mode: 'FIX' },
                ],
            },
        })
        expect(draft.warehouseId).toBe('wh-uuid-1')
        expect(draft.planTurnoverRatio).toBe('1.2')
        expect(draft.price).toBe('15000')

        const resolvedAgain = resolveShopRuleDraft(draft)
        expect(resolvedAgain.success).toBe(true)
        if (resolvedAgain.success && resolvedAgain.data.type === 'DepartmentTurnoverBonus') {
            expect(resolvedAgain.data.config.warehouseId).toBe('wh-uuid-1')
        }
    })
})
