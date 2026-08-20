import { describe, expect, it } from 'vitest'

import { createRuleDraft, defaultBorders, type BorderDraft, type RuleDraft } from '../../model/ruleDraft.ts'
import { resolveRuleDraft } from './ruleFormSchema.ts'

/**
 * `resolveRuleDraft` is the rule form's zod-резолвер (see `ruleFormSchema.ts`'s doc comment) — it
 * turns a `RuleDraft` into a validated `SalaryRuleRequest` or a field-level error map. These tests
 * focus on the two boundary classes Фаза 3 (docs/salary-schema-creation-ui) calls out explicitly:
 * the `percentBorders` tuple must be exactly 3 entries, and each award variant's own required
 * fields must actually be required.
 */

function baseDraft(overrides: Partial<RuleDraft> = {}): RuleDraft {
    return { ...createRuleDraft(), name: 'Тестовое правило', targetRole: 'ENGINEER', ...overrides }
}

describe('resolveRuleDraft — PayPerHour', () => {
    it('succeeds with a valid rate', () => {
        const result = resolveRuleDraft(baseDraft({ type: 'PayPerHour', price: '450' }))
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data).toEqual({
                type: 'PayPerHour',
                name: 'Тестовое правило',
                targetRole: 'ENGINEER',
                config: { price: 450 },
            })
        }
    })

    it('fails when the rate is missing', () => {
        const result = resolveRuleDraft(baseDraft({ type: 'PayPerHour', price: '' }))
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.price).toBeTruthy()
    })

    it('fails when name or role is missing', () => {
        const noName = resolveRuleDraft(baseDraft({ type: 'PayPerHour', price: '450', name: '  ' }))
        expect(noName.success).toBe(false)
        if (!noName.success) expect(noName.errors.name).toBeTruthy()

        const noRole = resolveRuleDraft(baseDraft({ type: 'PayPerHour', price: '450', targetRole: '' }))
        expect(noRole.success).toBe(false)
        if (!noRole.success) expect(noRole.errors.targetRole).toBeTruthy()
    })

    it('accepts a comma decimal rate', () => {
        const result = resolveRuleDraft(baseDraft({ type: 'PayPerHour', price: '450,5' }))
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'PayPerHour') {
            expect(result.data.config.price).toBeCloseTo(450.5)
        }
    })
})

describe('resolveRuleDraft — ServiceCompleted award variants', () => {
    it('ServiceFixed succeeds with no extra fields at all', () => {
        const result = resolveRuleDraft(baseDraft({ type: 'ServiceCompleted', awardKind: 'ServiceFixed' }))
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'ServiceCompleted') {
            expect(result.data.config.award).toEqual({ type: 'ServiceFixed' })
        }
    })

    it('Fixed requires a price', () => {
        const result = resolveRuleDraft(baseDraft({ type: 'ServiceCompleted', awardKind: 'Fixed', price: '' }))
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.price).toBeTruthy()
    })

    it('ServicePercent requires a percent', () => {
        const result = resolveRuleDraft(
            baseDraft({ type: 'ServiceCompleted', awardKind: 'ServicePercent', percent: '' }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.percent).toBeTruthy()
    })

    it('fails when no award variant is chosen at all', () => {
        const result = resolveRuleDraft(baseDraft({ type: 'ServiceCompleted', awardKind: '' }))
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.awardKind).toBeTruthy()
    })
})

describe('resolveRuleDraft — OrderPayed award variants', () => {
    it('FixedPercent requires both percent and salaryBasis', () => {
        const missingBasis = resolveRuleDraft(
            baseDraft({ type: 'OrderPayed', awardKind: 'FixedPercent', percent: '12', salaryBasis: '' }),
        )
        expect(missingBasis.success).toBe(false)
        if (!missingBasis.success) expect(missingBasis.errors.salaryBasis).toBeTruthy()

        const ok = resolveRuleDraft(
            baseDraft({ type: 'OrderPayed', awardKind: 'FixedPercent', percent: '12', salaryBasis: 'MARGIN' }),
        )
        expect(ok.success).toBe(true)
    })

    it('FloatPercent succeeds with exactly 3 valid percentBorders', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'OrderPayed',
                awardKind: 'FloatPercent',
                basePercent: '4',
                salaryBasis: 'MARGIN',
                percentBorders: defaultBorders(),
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'OrderPayed' && result.data.config.award.type === 'FloatPercent') {
            expect(result.data.config.award.percentBorders).toHaveLength(3)
        }
    })

    it('FloatPercent fails when there are only 2 percentBorders', () => {
        const twoBorders: BorderDraft[] = defaultBorders().slice(0, 2)
        const result = resolveRuleDraft(
            baseDraft({
                type: 'OrderPayed',
                awardKind: 'FloatPercent',
                basePercent: '4',
                salaryBasis: 'MARGIN',
                percentBorders: twoBorders,
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.thresholds).toContain('3')
    })

    it('FloatPercent fails when there are 4 percentBorders', () => {
        const fourBorders: BorderDraft[] = [
            ...defaultBorders(),
            { name: 'Экстра', fromPlanPercent: '150', multiplier: '2', mode: 'FIX' },
        ]
        const result = resolveRuleDraft(
            baseDraft({
                type: 'OrderPayed',
                awardKind: 'FloatPercent',
                basePercent: '4',
                salaryBasis: 'MARGIN',
                percentBorders: fourBorders,
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.thresholds).toContain('3')
    })

    it('FloatPercent fails when a border row is missing a required field', () => {
        const incomplete: BorderDraft[] = defaultBorders()
        incomplete[1] = { ...incomplete[1], multiplier: '' }
        const result = resolveRuleDraft(
            baseDraft({
                type: 'OrderPayed',
                awardKind: 'FloatPercent',
                basePercent: '4',
                salaryBasis: 'MARGIN',
                percentBorders: incomplete,
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.thresholds).toBeTruthy()
    })

    it('FloatPercent also requires basePercent even when borders are valid', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'OrderPayed',
                awardKind: 'FloatPercent',
                basePercent: '',
                salaryBasis: 'MARGIN',
                percentBorders: defaultBorders(),
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.basePercent).toBeTruthy()
    })
})

describe('resolveRuleDraft — TaskCompleted award variants', () => {
    it('has no FixedPercent option — Fixed and FloatPercent only, per the contract', () => {
        const result = resolveRuleDraft(baseDraft({ type: 'TaskCompleted', awardKind: 'FixedPercent' as never }))
        expect(result.success).toBe(false)
    })

    it('FloatPercent requires basePrice and exactly 3 percentBorders, with no salaryBasis field', () => {
        const missingPrice = resolveRuleDraft(
            baseDraft({
                type: 'TaskCompleted',
                awardKind: 'FloatPercent',
                basePrice: '',
                percentBorders: defaultBorders(),
            }),
        )
        expect(missingPrice.success).toBe(false)
        if (!missingPrice.success) expect(missingPrice.errors.basePrice).toBeTruthy()

        const ok = resolveRuleDraft(
            baseDraft({
                type: 'TaskCompleted',
                awardKind: 'FloatPercent',
                basePrice: '300',
                percentBorders: defaultBorders(),
            }),
        )
        expect(ok.success).toBe(true)
        if (ok.success && ok.data.type === 'TaskCompleted' && ok.data.config.award.type === 'FloatPercent') {
            expect('salaryBasis' in ok.data.config.award).toBe(false)
            expect(ok.data.config.award.percentBorders).toHaveLength(3)
        }
    })

    it('FloatPercent fails with 2 percentBorders even when basePrice is set', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'TaskCompleted',
                awardKind: 'FloatPercent',
                basePrice: '300',
                percentBorders: defaultBorders().slice(0, 2),
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.thresholds).toContain('2')
    })

    it('Fixed succeeds with just a price', () => {
        const result = resolveRuleDraft(baseDraft({ type: 'TaskCompleted', awardKind: 'Fixed', price: '300' }))
        expect(result.success).toBe(true)
    })
})
