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
                taskLinkTemplates: [],
            })
        }
    })

    // add-task-rule-task-lifecycle
    it('carries taskLinkTemplates through unchanged', () => {
        const linkTemplates = [{ url: 'https://example.com/1', label: 'Отчёт' }]
        const result = resolveRuleDraft(
            baseDraft({ type: 'TaskCompletion', taskId: 'task-1', price: '5000', taskLinkTemplates: linkTemplates }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion') {
            expect(result.data.config.taskLinkTemplates).toEqual(linkTemplates)
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
            isActive: true,
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
        expect(draft.taskLinkTemplates).toEqual([])

        const resolvedAgain = resolveRuleDraft(draft)
        expect(resolvedAgain.success).toBe(true)
        if (resolvedAgain.success && resolvedAgain.data.type === 'TaskCompletion') {
            expect(resolvedAgain.data.config.taskId).toBe('task-1')
            expect(resolvedAgain.data.config.taskDescriptionTemplate).toBe('Смотри требования в ТЗ')
            expect(resolvedAgain.data.config.defaultAmount).toBe(5000)
        }
    })

    // add-task-rule-task-lifecycle
    it('round-trips taskLinkTemplates when the response carries them', () => {
        const draft = draftFromRule({
            id: 'rule-1',
            type: 'TaskCompletion',
            name: 'Обновить фото витрины',
            targetRole: 'ENGINEER',
            isActive: true,
            config: {
                taskTitleTemplate: 'Обновить фото витрины',
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
        const draft = draftFromRule({
            id: 'rule-2',
            type: 'TaskCompletion',
            name: 'Проверка склада',
            targetRole: 'ENGINEER',
            isActive: true,
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

/**
 * add-department-head-salary-rules, FR2-FR4 — the 3 new department-level rule types (design.md
 * Decision 2: not transactional, no `award` variant selector at all — ui-design.md «Отклонения»,
 * «Блок «Вариант награды» не переиспользован для FR2–FR4»). `targetRole: 'DEPARTMENT_HEAD'` (FR1)
 * is the role these are designed for, though `resolveRuleDraft` itself accepts any `targetRole` from
 * the shared enum — the role/type pairing is a UI-level concern (`RuleRoleField`/`useAllowedRolesByType`),
 * not something this resolver enforces.
 */
describe('resolveRuleDraft — DepartmentPercent (FR2)', () => {
    it('succeeds with salaryBasis, category null ("весь склад/направление") and percent', () => {
        const result = resolveRuleDraft(
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

    it('carries a specific category id through', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'DepartmentPercent',
                targetRole: 'DEPARTMENT_HEAD',
                salaryBasis: 'REVENUE',
                category: 'repair-id',
                percent: '3',
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'DepartmentPercent') {
            expect(result.data.config.category).toBe('repair-id')
        }
    })

    it('fails when percent is missing', () => {
        const result = resolveRuleDraft(
            baseDraft({ type: 'DepartmentPercent', targetRole: 'DEPARTMENT_HEAD', salaryBasis: 'REVENUE', percent: '' }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.percent).toBeTruthy()
    })

    it('fails when salaryBasis is not chosen', () => {
        const result = resolveRuleDraft(
            baseDraft({ type: 'DepartmentPercent', targetRole: 'DEPARTMENT_HEAD', salaryBasis: '', percent: '5' }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.salaryBasis).toBeTruthy()
    })
})

describe('resolveRuleDraft — DepartmentPlanBonus (FR3)', () => {
    it('succeeds with a fixed amount and exactly 3 valid percentBorders', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'DepartmentPlanBonus',
                targetRole: 'DEPARTMENT_HEAD',
                salaryBasis: 'MARGIN',
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

    it('fails when the fixed amount is missing', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'DepartmentPlanBonus',
                targetRole: 'DEPARTMENT_HEAD',
                salaryBasis: 'MARGIN',
                price: '',
                percentBorders: defaultBorders(),
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.price).toBeTruthy()
    })

    it('fails with only 2 percentBorders', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'DepartmentPlanBonus',
                targetRole: 'DEPARTMENT_HEAD',
                salaryBasis: 'MARGIN',
                price: '10000',
                percentBorders: defaultBorders().slice(0, 2),
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.thresholds).toContain('2')
    })
})

describe('resolveRuleDraft — DepartmentTurnoverBonus (FR4)', () => {
    it('succeeds with a numeric warehouseId (RoApp id), plan ratio and exactly 3 percentBorders', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'DepartmentTurnoverBonus',
                targetRole: 'DEPARTMENT_HEAD',
                warehouseId: '7',
                category: null,
                price: '15000',
                planTurnoverRatio: '1.2',
                percentBorders: defaultBorders(),
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'DepartmentTurnoverBonus') {
            expect(result.data.config.warehouseId).toBe(7)
            expect(result.data.config.fixedAmount).toBe(15000)
            expect(result.data.config.planTurnoverRatio).toBe(1.2)
            expect(result.data.config.percentBorders).toHaveLength(3)
        }
    })

    it('carries a specific category id (scope within the warehouse) through', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'DepartmentTurnoverBonus',
                targetRole: 'DEPARTMENT_HEAD',
                warehouseId: '7',
                category: 'accessories-id',
                price: '15000',
                planTurnoverRatio: '1.2',
                percentBorders: defaultBorders(),
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'DepartmentTurnoverBonus') {
            expect(result.data.config.category).toBe('accessories-id')
        }
    })

    it('fails when the warehouse is not selected', () => {
        const result = resolveRuleDraft(
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
        const result = resolveRuleDraft(
            baseDraft({
                type: 'DepartmentTurnoverBonus',
                targetRole: 'DEPARTMENT_HEAD',
                warehouseId: '7',
                price: '15000',
                planTurnoverRatio: '',
                percentBorders: defaultBorders(),
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.planTurnoverRatio).toBeTruthy()
    })

    it('fails with only 2 percentBorders', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'DepartmentTurnoverBonus',
                targetRole: 'DEPARTMENT_HEAD',
                warehouseId: '7',
                price: '15000',
                planTurnoverRatio: '1.2',
                percentBorders: defaultBorders().slice(0, 2),
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.thresholds).toContain('2')
    })
})

describe('draftFromRule — department-level rule types round-trip (FR2-FR4)', () => {
    it('DepartmentPercent', () => {
        const draft = draftFromRule({
            id: 'rule-dep-1',
            type: 'DepartmentPercent',
            name: 'Процент от маржи направления',
            targetRole: 'DEPARTMENT_HEAD',
            config: { salaryBasis: 'MARGIN', category: null, percent: 5 },
        })
        expect(draft.type).toBe('DepartmentPercent')
        expect(draft.salaryBasis).toBe('MARGIN')
        expect(draft.category).toBeNull()
        expect(draft.percent).toBe('5')

        const resolvedAgain = resolveRuleDraft(draft)
        expect(resolvedAgain.success).toBe(true)
        if (resolvedAgain.success && resolvedAgain.data.type === 'DepartmentPercent') {
            expect(resolvedAgain.data.config).toEqual({ salaryBasis: 'MARGIN', category: null, percent: 5 })
        }
    })

    it('DepartmentPlanBonus', () => {
        const draft = draftFromRule({
            id: 'rule-dep-2',
            type: 'DepartmentPlanBonus',
            name: 'Премия за план выручки',
            targetRole: 'DEPARTMENT_HEAD',
            config: { salaryBasis: 'REVENUE', category: 'repair-id', fixedAmount: 10000, percentBorders: defaultBordersResponse() },
        })
        expect(draft.salaryBasis).toBe('REVENUE')
        expect(draft.category).toBe('repair-id')
        expect(draft.price).toBe('10000')
        expect(draft.percentBorders).toHaveLength(3)

        const resolvedAgain = resolveRuleDraft(draft)
        expect(resolvedAgain.success).toBe(true)
        if (resolvedAgain.success && resolvedAgain.data.type === 'DepartmentPlanBonus') {
            expect(resolvedAgain.data.config.fixedAmount).toBe(10000)
        }
    })

    it('DepartmentTurnoverBonus', () => {
        const draft = draftFromRule({
            id: 'rule-dep-3',
            type: 'DepartmentTurnoverBonus',
            name: 'Премия за оборачиваемость',
            targetRole: 'DEPARTMENT_HEAD',
            config: {
                warehouseId: 7,
                category: 'repair-id',
                fixedAmount: 15000,
                planTurnoverRatio: 1.2,
                percentBorders: defaultBordersResponse(),
            },
        })
        expect(draft.warehouseId).toBe('7')
        expect(draft.planTurnoverRatio).toBe('1.2')
        expect(draft.price).toBe('15000')
        expect(draft.category).toBe('repair-id')

        const resolvedAgain = resolveRuleDraft(draft)
        expect(resolvedAgain.success).toBe(true)
        if (resolvedAgain.success && resolvedAgain.data.type === 'DepartmentTurnoverBonus') {
            expect(resolvedAgain.data.config.warehouseId).toBe(7)
        }
    })
})

type PercentBorderResponse = { name: string; fromPlanPercent: number; multiplier: number; mode: 'FIX' | 'LINEAR' }

function defaultBordersResponse(): [PercentBorderResponse, PercentBorderResponse, PercentBorderResponse] {
    const [a, b, c] = defaultBorders()
    const toResponse = (border: BorderDraft): PercentBorderResponse => ({
        name: border.name,
        fromPlanPercent: Number(border.fromPlanPercent),
        multiplier: Number(border.multiplier),
        mode: border.mode,
    })
    return [toResponse(a), toResponse(b), toResponse(c)]
}
