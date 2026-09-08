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
 * replace-bitrix-task-integration, раздел 14 tasks.md (14.5) — `TaskCompletion` больше не заводит
 * задачу через эту форму (design.md решение 2/4): задача уже существует, её `taskId` приходит от
 * мастера (`CreateTaskCompletionRuleWizard`, Шаг 1), форма правила лишь ссылается на неё и
 * настраивает ШАБЛОН для авто-пересоздания задачи регулярного правила на новый период
 * (`taskTitleTemplate`/`taskDescriptionTemplate`/`deadlineTemplate` — не поля самой первой
 * задачи).
 */
describe('resolveRuleDraft — TaskCompletion', () => {
    it('carries the already-created taskId and the recurrence template fields through', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'TaskCompletion',
                name: 'Обновить фото витрины',
                taskId: 'task-1',
                taskTitleTemplate: 'Обновить фото витрины ({месяц})',
                taskDescriptionTemplate: 'Смотри требования в ТЗ',
                isRecurring: true,
                deadlineTemplate: '2026-09-25',
                price: '5000',
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion') {
            expect(result.data.config).toEqual({
                taskId: 'task-1',
                taskTitleTemplate: 'Обновить фото витрины ({месяц})',
                taskDescriptionTemplate: 'Смотри требования в ТЗ',
                isRecurring: true,
                deadlineTemplate: '2026-09-25',
                defaultAmount: 5000,
            })
        }
    })

    it('omits taskDescriptionTemplate entirely when left blank (optional in the contract)', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'TaskCompletion',
                taskId: 'task-1',
                isRecurring: false,
                price: '5000',
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion') {
            expect('taskDescriptionTemplate' in result.data.config).toBe(false)
        }
    })

    it('fails when the task was never created on Step 1 (empty taskId — regression guard)', () => {
        const result = resolveRuleDraft(baseDraft({ type: 'TaskCompletion', taskId: '', price: '5000' }))
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.taskId).toBeTruthy()
    })

    it('fails when the default amount is missing', () => {
        const result = resolveRuleDraft(baseDraft({ type: 'TaskCompletion', taskId: 'task-1', price: '' }))
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.price).toBeTruthy()
    })

    it('requires the template title/deadline only for a recurring rule', () => {
        const notRecurring = resolveRuleDraft(
            baseDraft({ type: 'TaskCompletion', taskId: 'task-1', isRecurring: false, price: '5000' }),
        )
        expect(notRecurring.success).toBe(true)

        const recurring = resolveRuleDraft(
            baseDraft({ type: 'TaskCompletion', taskId: 'task-1', isRecurring: true, price: '5000' }),
        )
        expect(recurring.success).toBe(false)
        if (!recurring.success) {
            expect(recurring.errors.taskTitleTemplate).toBeTruthy()
            expect(recurring.errors.dueDate).toBeTruthy()
        }
    })
})

describe('draftFromRule — TaskCompletion', () => {
    it('round-trips a persisted rule back into a draft usable by resolveRuleDraft', () => {
        const draft = draftFromRule({
            id: 'rule-1',
            type: 'TaskCompletion',
            name: 'Обновить фото витрины',
            targetRole: 'ENGINEER',
            config: {
                taskTitleTemplate: 'Обновить фото витрины ({месяц})',
                taskDescriptionTemplate: 'Смотри требования в ТЗ',
                isRecurring: true,
                deadlineTemplate: '2026-09-25',
                defaultAmount: 5000,
                taskIdByPeriod: { '2026-08': 'task-old', '2026-09': 'task-1' },
            },
        })
        expect(draft.type).toBe('TaskCompletion')
        expect(draft.name).toBe('Обновить фото витрины')
        // Последний период в карте — id задачи, актуальной для формы редактирования (см.
        // `latestTaskId`'s комментарий в `ruleFormSchema.ts`).
        expect(draft.taskId).toBe('task-1')
        expect(draft.taskTitleTemplate).toBe('Обновить фото витрины ({месяц})')
        expect(draft.taskDescriptionTemplate).toBe('Смотри требования в ТЗ')
        expect(draft.isRecurring).toBe(true)
        expect(draft.deadlineTemplate).toBe('2026-09-25')
        expect(draft.price).toBe('5000')

        const resolvedAgain = resolveRuleDraft(draft)
        expect(resolvedAgain.success).toBe(true)
        if (resolvedAgain.success && resolvedAgain.data.type === 'TaskCompletion') {
            expect(resolvedAgain.data.config.taskId).toBe('task-1')
            expect(resolvedAgain.data.config.taskDescriptionTemplate).toBe('Смотри требования в ТЗ')
            expect(resolvedAgain.data.config.defaultAmount).toBe(5000)
        }
    })

    it('defaults taskDescriptionTemplate to an empty string and taskId to "" when the map is empty', () => {
        const draft = draftFromRule({
            id: 'rule-2',
            type: 'TaskCompletion',
            name: 'Проверка склада',
            targetRole: 'ENGINEER',
            config: {
                taskTitleTemplate: '',
                isRecurring: false,
                deadlineTemplate: '',
                defaultAmount: 3000,
                taskIdByPeriod: {},
            },
        })
        expect(draft.taskId).toBe('')
        expect(draft.taskDescriptionTemplate).toBe('')
        expect(draft.isRecurring).toBe(false)
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
