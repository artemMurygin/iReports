import { describe, expect, it } from 'vitest'

import type { RuleFieldErrors } from './formNumberUtils.ts'
import { createRuleDraft, defaultBorders, type RuleDraft } from './ruleDraft.ts'
import {
    buildDepartmentPercentConfig,
    buildDepartmentPlanBonusConfig,
    buildDepartmentTurnoverBonusConfig,
} from './ruleAwards.ts'

/**
 * add-department-head-salary-rules, FR2-FR4 — config builders for the 3 new department-level rule
 * types (see this file's own header comment for why they live next to `buildServiceCompletedAward`/
 * `buildOrderPayedAward`: same "build a plain JS object from the draft's strings, let the resolver's
 * own `safeParse` be the real gate" contract, shared between `service/model/ruleFormSchema.ts` and
 * `shop/model/ruleFormSchema.ts`). These tests exercise the builders directly (not through
 * `resolveRuleDraft`/`resolveShopRuleDraft`) — `ruleFormSchema.test.ts` (both directions) covers the
 * end-to-end `safeParse` round trip.
 */

function draft(overrides: Partial<RuleDraft> = {}): RuleDraft {
    return { ...createRuleDraft(), ...overrides }
}

describe('buildDepartmentPercentConfig (FR2)', () => {
    it('builds { salaryBasis, category, percent } from the draft', () => {
        const errors: RuleFieldErrors = {}
        const config = buildDepartmentPercentConfig(
            draft({ salaryBasis: 'MARGIN', category: 'repair-id', percent: '5' }),
            errors,
        )
        expect(config).toEqual({ salaryBasis: 'MARGIN', category: 'repair-id', percent: 5 })
        expect(errors).toEqual({})
    })

    it('category null ("весь склад/направление") is a valid default, not a validation error', () => {
        const errors: RuleFieldErrors = {}
        const config = buildDepartmentPercentConfig(draft({ salaryBasis: 'REVENUE', category: null, percent: '3' }), errors)
        expect(config).toEqual({ salaryBasis: 'REVENUE', category: null, percent: 3 })
        expect(errors).toEqual({})
    })

    it('records a field error when percent is missing', () => {
        const errors: RuleFieldErrors = {}
        buildDepartmentPercentConfig(draft({ salaryBasis: 'MARGIN', percent: '' }), errors)
        expect(errors.percent).toBeTruthy()
    })

    it('records a field error when salaryBasis is not chosen', () => {
        const errors: RuleFieldErrors = {}
        buildDepartmentPercentConfig(draft({ salaryBasis: '', percent: '5' }), errors)
        expect(errors.salaryBasis).toBeTruthy()
    })
})

describe('buildDepartmentPlanBonusConfig (FR3)', () => {
    it('builds { salaryBasis, category, fixedAmount, percentBorders } from the draft', () => {
        const errors: RuleFieldErrors = {}
        const config = buildDepartmentPlanBonusConfig(
            draft({ salaryBasis: 'REVENUE', category: null, price: '10000', percentBorders: defaultBorders() }),
            errors,
        ) as { salaryBasis: string; category: string | null; fixedAmount: number; percentBorders: unknown[] }
        expect(config.salaryBasis).toBe('REVENUE')
        expect(config.category).toBeNull()
        expect(config.fixedAmount).toBe(10000)
        expect(config.percentBorders).toHaveLength(3)
        expect(errors).toEqual({})
    })

    it('records a field error when the fixed amount is missing', () => {
        const errors: RuleFieldErrors = {}
        buildDepartmentPlanBonusConfig(
            draft({ salaryBasis: 'REVENUE', price: '', percentBorders: defaultBorders() }),
            errors,
        )
        expect(errors.price).toBeTruthy()
    })

    it('records a thresholds error when percentBorders is not exactly 3 rows', () => {
        const errors: RuleFieldErrors = {}
        buildDepartmentPlanBonusConfig(
            draft({ salaryBasis: 'REVENUE', price: '10000', percentBorders: defaultBorders().slice(0, 2) }),
            errors,
        )
        expect(errors.thresholds).toContain('2')
    })
})

describe('buildDepartmentTurnoverBonusConfig (FR4)', () => {
    it('parses warehouseId as a number when warehouseIdKind is "number" (service, RoApp id)', () => {
        const errors: RuleFieldErrors = {}
        const config = buildDepartmentTurnoverBonusConfig(
            draft({
                warehouseId: '7',
                category: null,
                price: '15000',
                planTurnoverRatio: '1.2',
                percentBorders: defaultBorders(),
            }),
            errors,
            'number',
        ) as { warehouseId: unknown; fixedAmount: number; planTurnoverRatio: number; percentBorders: unknown[] }
        expect(config.warehouseId).toBe(7)
        expect(config.fixedAmount).toBe(15000)
        expect(config.planTurnoverRatio).toBe(1.2)
        expect(config.percentBorders).toHaveLength(3)
        expect(errors).toEqual({})
    })

    it('keeps warehouseId as a string when warehouseIdKind is "string" (shop, MoySklad UUID)', () => {
        const errors: RuleFieldErrors = {}
        const config = buildDepartmentTurnoverBonusConfig(
            draft({
                warehouseId: 'wh-uuid-1',
                category: null,
                price: '15000',
                planTurnoverRatio: '1.2',
                percentBorders: defaultBorders(),
            }),
            errors,
            'string',
        ) as { warehouseId: unknown }
        expect(config.warehouseId).toBe('wh-uuid-1')
        expect(errors).toEqual({})
    })

    it('records a field error when the warehouse is not selected', () => {
        const errors: RuleFieldErrors = {}
        buildDepartmentTurnoverBonusConfig(
            draft({ warehouseId: '', price: '15000', planTurnoverRatio: '1.2', percentBorders: defaultBorders() }),
            errors,
            'number',
        )
        expect(errors.warehouseId).toBeTruthy()
    })

    it('records a field error when the fixed amount is missing', () => {
        const errors: RuleFieldErrors = {}
        buildDepartmentTurnoverBonusConfig(
            draft({ warehouseId: '7', price: '', planTurnoverRatio: '1.2', percentBorders: defaultBorders() }),
            errors,
            'number',
        )
        expect(errors.price).toBeTruthy()
    })

    it('records a field error when the plan turnover ratio is missing', () => {
        const errors: RuleFieldErrors = {}
        buildDepartmentTurnoverBonusConfig(
            draft({ warehouseId: '7', price: '15000', planTurnoverRatio: '', percentBorders: defaultBorders() }),
            errors,
            'number',
        )
        expect(errors.planTurnoverRatio).toBeTruthy()
    })

    it('records a field error when the plan turnover ratio is not positive (TurnoverRatioValueObject invariant)', () => {
        const errors: RuleFieldErrors = {}
        buildDepartmentTurnoverBonusConfig(
            draft({ warehouseId: '7', price: '15000', planTurnoverRatio: '0', percentBorders: defaultBorders() }),
            errors,
            'number',
        )
        expect(errors.planTurnoverRatio).toBeTruthy()
    })

    it('records a thresholds error when percentBorders is not exactly 3 rows', () => {
        const errors: RuleFieldErrors = {}
        buildDepartmentTurnoverBonusConfig(
            draft({
                warehouseId: '7',
                price: '15000',
                planTurnoverRatio: '1.2',
                percentBorders: defaultBorders().slice(0, 2),
            }),
            errors,
            'number',
        )
        expect(errors.thresholds).toContain('2')
    })
})
