import { describe, expect, it } from 'vitest'

import { createRuleDraft, defaultBorders, type BorderDraft, type RuleDraft } from '../../model/ruleDraft.ts'
import { draftFromRule, resolveRuleDraft } from './ruleFormSchema.ts'

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

    it('defaults to an empty orderTypeIds ("все типы") when none is selected', () => {
        const result = resolveRuleDraft(baseDraft({ type: 'ServiceCompleted', awardKind: 'ServiceFixed' }))
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'ServiceCompleted') {
            expect(result.data.config.orderTypeIds).toEqual([])
        }
    })

    it('carries the selected orderTypeIds through to the payload', () => {
        const result = resolveRuleDraft(
            baseDraft({ type: 'ServiceCompleted', awardKind: 'ServiceFixed', orderTypeIds: [1, 2] }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'ServiceCompleted') {
            expect(result.data.config.orderTypeIds).toEqual([1, 2])
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

    it('defaults to an empty orderTypeIds ("все типы") when none is selected', () => {
        const result = resolveRuleDraft(
            baseDraft({ type: 'OrderPayed', awardKind: 'FixedPercent', percent: '12', salaryBasis: 'MARGIN' }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'OrderPayed') {
            expect(result.data.config.orderTypeIds).toEqual([])
        }
    })

    it('carries the selected orderTypeIds through to the payload', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'OrderPayed',
                awardKind: 'FixedPercent',
                percent: '12',
                salaryBasis: 'MARGIN',
                orderTypeIds: [3, 7, 9],
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'OrderPayed') {
            expect(result.data.config.orderTypeIds).toEqual([3, 7, 9])
        }
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

/**
 * `TaskCompletion` (tasks.md раздел 20, node `wV3fv`/`aS8yc`) — единственный тип правила без
 * "вознаграждения" в обычном смысле: сумма всегда вводится вручную позже (`SalaryAccruals`,
 * раздел 24), форма правила лишь настраивает саму задачу Bitrix24. По решению из фрейма `wV3fv`
 * (см. `u821y`'s hint "Из него формируется заголовок задачи в Bitrix24") отдельного поля «Название
 * задачи» в форме нет — `bitrixTaskTitle` строится из уже существующего `draft.name`.
 */
describe('resolveRuleDraft — TaskCompletion', () => {
    it('builds bitrixTaskTitle from the rule name and carries the task fields through', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'TaskCompletion',
                name: 'Обновить фото витрины',
                taskDescription: 'Смотри требования в ТЗ',
                isRecurring: true,
                deadlineTemplate: '2026-09-25',
                price: '5000',
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion') {
            expect(result.data.config).toEqual({
                bitrixTaskTitle: 'Обновить фото витрины',
                taskDescription: 'Смотри требования в ТЗ',
                isRecurring: true,
                deadlineTemplate: '2026-09-25',
                defaultAmount: 5000,
            })
        }
    })

    it('omits taskDescription entirely when left blank (optional in the contract)', () => {
        const result = resolveRuleDraft(
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
        const result = resolveRuleDraft(baseDraft({ type: 'TaskCompletion', deadlineTemplate: '', price: '5000' }))
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.dueDate).toBeTruthy()
    })

    it('fails when the default amount is missing', () => {
        const result = resolveRuleDraft(
            baseDraft({ type: 'TaskCompletion', deadlineTemplate: '2026-09-25', price: '' }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.price).toBeTruthy()
    })

    it('defaults isRecurring to false for a one-off task', () => {
        const result = resolveRuleDraft(
            baseDraft({ type: 'TaskCompletion', deadlineTemplate: '2026-09-25', isRecurring: false, price: '5000' }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion') {
            expect(result.data.config.isRecurring).toBe(false)
        }
    })
})

describe('draftFromRule — TaskCompletion', () => {
    it('round-trips a persisted rule back into a draft usable by resolveRuleDraft', () => {
        const created = resolveRuleDraft(
            baseDraft({
                type: 'TaskCompletion',
                name: 'Обновить фото витрины',
                taskDescription: 'Смотри требования в ТЗ',
                isRecurring: false,
                deadlineTemplate: '2026-09-25',
                price: '5000',
            }),
        )
        expect(created.success).toBe(true)
        if (!created.success) return

        const draft = draftFromRule({ ...created.data, id: 'rule-1' })
        expect(draft.type).toBe('TaskCompletion')
        expect(draft.name).toBe('Обновить фото витрины')
        expect(draft.taskDescription).toBe('Смотри требования в ТЗ')
        expect(draft.isRecurring).toBe(false)
        expect(draft.deadlineTemplate).toBe('2026-09-25')
        expect(draft.price).toBe('5000')

        const resolvedAgain = resolveRuleDraft(draft)
        expect(resolvedAgain.success).toBe(true)
        if (resolvedAgain.success && resolvedAgain.data.type === 'TaskCompletion') {
            expect(resolvedAgain.data.config.taskDescription).toBe('Смотри требования в ТЗ')
            expect(resolvedAgain.data.config.defaultAmount).toBe(5000)
        }
    })

    it('defaults taskDescription to an empty string when the persisted rule has none', () => {
        const draft = draftFromRule({
            id: 'rule-2',
            type: 'TaskCompletion',
            name: 'Проверка склада',
            targetRole: 'ENGINEER',
            config: {
                bitrixTaskTitle: 'Проверка склада',
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

describe('resolveRuleDraft — PayPerHour never carries orderTypeIds', () => {
    it('the field only exists on OrderPayed/ServiceCompleted', () => {
        const result = resolveRuleDraft(baseDraft({ type: 'PayPerHour', price: '450', orderTypeIds: [1, 2] }))
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'PayPerHour') {
            expect('orderTypeIds' in result.data.config).toBe(false)
        }
    })
})
