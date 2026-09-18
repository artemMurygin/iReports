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
 * split-task-completion-rule-form — `TaskCompletion`'s config is a discriminated union on
 * `isRecurring` (see `RuleDraft.taskTitle`'s comment, `../../model/ruleDraft.ts`): a one-off rule's
 * task (`isRecurring: false`) is created by the SAME request as the rule itself, from literal
 * `taskTitle`/`taskDeadline`/`taskDescription`/`taskLinks` fields — but only while the task doesn't
 * exist yet (`draft.taskId === ''`); once it exists (editing an already-persisted rule), those
 * literal fields are never sent again (`draft.taskId` itself never reaches the request either — the
 * contract has no `taskId` field at all, see `taskCompletionSalaryConfigRequestSchema`,
 * `contracts/commands/salary-rule.ts`). A recurring rule (`isRecurring: true`) keeps configuring a
 * TEMPLATE for auto-recreating the task on each new period (`taskTitleTemplate`/
 * `taskDescriptionTemplate`/`deadlineTemplate`/`createTaskForCurrentPeriod`) — not fields of the
 * first task itself.
 */
describe('resolveRuleDraft — TaskCompletion', () => {
    it('one-off, new task (taskId === ""): builds the request from the literal task fields', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'TaskCompletion',
                name: 'Обновить фото витрины',
                taskId: '',
                isRecurring: false,
                taskTitle: 'Обновить фото витрины',
                taskDescription: 'Смотри требования в ТЗ',
                taskDeadline: '2026-09-25',
                taskLinks: [{ url: 'https://example.com/1', label: 'Отчёт' }],
                accountingPeriod: '2026-09',
                price: '5000',
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion') {
            expect(result.data.config).toEqual({
                isRecurring: false,
                accountingPeriod: '2026-09',
                defaultAmount: 5000,
                taskTitle: 'Обновить фото витрины',
                taskDescription: 'Смотри требования в ТЗ',
                taskDeadline: '2026-09-25',
                taskLinks: [{ url: 'https://example.com/1', label: 'Отчёт' }],
            })
        }
    })

    it('one-off, already-created task (taskId !== ""): sends no literal task fields at all', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'TaskCompletion',
                taskId: 'task-1',
                isRecurring: false,
                accountingPeriod: '2026-09',
                price: '5000',
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion') {
            expect(result.data.config).toEqual({
                isRecurring: false,
                accountingPeriod: '2026-09',
                defaultAmount: 5000,
            })
        }
    })

    it('recurring: carries the recurrence template fields plus createTaskForCurrentPeriod through', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'TaskCompletion',
                name: 'Обновить фото витрины',
                taskId: 'task-1',
                taskTitleTemplate: 'Обновить фото витрины ({месяц})',
                taskDescriptionTemplate: 'Смотри требования в ТЗ',
                isRecurring: true,
                deadlineTemplate: '2026-09-25',
                accountingPeriod: '2026-09',
                createTaskForCurrentPeriod: true,
                price: '5000',
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion') {
            expect(result.data.config).toEqual({
                isRecurring: true,
                accountingPeriod: '2026-09',
                taskTitleTemplate: 'Обновить фото витрины ({месяц})',
                taskDescriptionTemplate: 'Смотри требования в ТЗ',
                // recurring-task-deadline-offset v2 — `resolveRuleDraft` нормализует
                // `deadlineTemplate` регулярного правила в канонический носитель дня
                // (`normalizeDeadlineDayTemplate`), день (25) сохраняется, месяц/год — нет.
                deadlineTemplate: '2000-01-25',
                deadlinePeriodOffset: 0,
                taskLinkTemplates: [],
                createTaskForCurrentPeriod: true,
                defaultAmount: 5000,
            })
        }
    })

    // add-task-rule-task-lifecycle
    it('carries taskLinkTemplates through unchanged (recurring)', () => {
        const linkTemplates = [{ url: 'https://example.com/1', label: 'Отчёт' }]
        const result = resolveRuleDraft(
            baseDraft({
                type: 'TaskCompletion',
                taskId: 'task-1',
                isRecurring: true,
                taskTitleTemplate: 'Шаблон',
                deadlineTemplate: '2026-09-25',
                price: '5000',
                taskLinkTemplates: linkTemplates,
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion' && result.data.config.isRecurring) {
            expect(result.data.config.taskLinkTemplates).toEqual(linkTemplates)
        }
    })

    it('omits taskDescriptionTemplate entirely when left blank (optional in the contract)', () => {
        const result = resolveRuleDraft(
            baseDraft({
                type: 'TaskCompletion',
                taskId: 'task-1',
                isRecurring: true,
                taskTitleTemplate: 'Шаблон',
                deadlineTemplate: '2026-09-25',
                price: '5000',
            }),
        )
        expect(result.success).toBe(true)
        if (result.success && result.data.type === 'TaskCompletion') {
            expect('taskDescriptionTemplate' in result.data.config).toBe(false)
        }
    })

    // split-task-completion-rule-form regression guard — `taskId` itself is no longer a resolver
    // concern (the contract doesn't even carry it): for a brand-new one-off rule (`taskId === ''`),
    // it's `taskTitle`/`taskDeadline` that become required instead.
    it('one-off, new task: fails with taskTitle/taskDeadline errors when those literal fields are empty', () => {
        const result = resolveRuleDraft(
            baseDraft({ type: 'TaskCompletion', taskId: '', isRecurring: false, price: '5000' }),
        )
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.errors.taskTitle).toBeTruthy()
            expect(result.errors.taskDeadline).toBeTruthy()
        }
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

/**
 * recurring-task-deadline-offset, FR1 — «Дедлайн относится к» (Select, `TaskCompletionRuleFields.tsx`),
 * поле `RuleDraft.deadlinePeriodOffset` (обычное число, не VO — VO конструируется транзитно только
 * на бэкенде, см. architecture.md поправку из tasks.md группы 9). Зеркально покрыто в
 * `shop/model/ruleFormSchema.test.ts`.
 */
describe('resolveRuleDraft — TaskCompletion deadlinePeriodOffset (recurring-task-deadline-offset)', () => {
    it('defaults to 0 on a brand-new RuleDraft', () => {
        expect(createRuleDraft().deadlinePeriodOffset).toBe(0)
    })

    it('resolves a valid deadlinePeriodOffset (1..3) into the request', () => {
        for (const offset of [1, 2, 3]) {
            const result = resolveRuleDraft(
                baseDraft({
                    type: 'TaskCompletion',
                    taskId: 'task-1',
                    isRecurring: true,
                    taskTitleTemplate: 'Шаблон',
                    deadlineTemplate: '2026-09-25',
                    price: '5000',
                    deadlinePeriodOffset: offset,
                }),
            )
            expect(result.success).toBe(true)
            if (result.success && result.data.type === 'TaskCompletion' && result.data.config.isRecurring) {
                expect(result.data.config.deadlinePeriodOffset).toBe(offset)
            }
        }
    })

    it('rejects a value outside 0..3 with a clear field error', () => {
        for (const invalid of [-1, 4, 1.5]) {
            const result = resolveRuleDraft(
                baseDraft({
                    type: 'TaskCompletion',
                    taskId: 'task-1',
                    isRecurring: true,
                    taskTitleTemplate: 'Шаблон',
                    deadlineTemplate: '2026-09-25',
                    price: '5000',
                    deadlinePeriodOffset: invalid,
                }),
            )
            expect(result.success).toBe(false)
            if (!result.success) expect(result.errors.deadlinePeriodOffset).toBeTruthy()
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
                deadlinePeriodOffset: 2,
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
        // recurring-task-deadline-offset — переносится из ответа как есть (см. draftFromRule).
        expect(draft.deadlinePeriodOffset).toBe(2)
        expect(draft.price).toBe('5000')
        expect(draft.taskLinkTemplates).toEqual([])

        const resolvedAgain = resolveRuleDraft(draft)
        expect(resolvedAgain.success).toBe(true)
        // split-task-completion-rule-form — `taskId` is no longer part of the request contract at
        // all (`taskCompletionSalaryConfigRequestSchema` has no `taskId` field, neither variant).
        if (resolvedAgain.success && resolvedAgain.data.type === 'TaskCompletion' && resolvedAgain.data.config.isRecurring) {
            expect(resolvedAgain.data.config.taskDescriptionTemplate).toBe('Смотри требования в ТЗ')
            expect(resolvedAgain.data.config.defaultAmount).toBe(5000)
            expect(resolvedAgain.data.config.deadlinePeriodOffset).toBe(2)
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
                deadlinePeriodOffset: 1,
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
            // isRecurring: false response — no template fields at all (see
            // `taskCompletionOneOffConfigResponseSchema`, `contracts/commands/salary-rule.ts`).
            config: {
                isRecurring: false,
                defaultAmount: 3000,
                taskIdByPeriod: {},
            },
        })
        expect(draft.taskId).toBe('')
        expect(draft.taskDescriptionTemplate).toBe('')
        expect(draft.deadlinePeriodOffset).toBe(0)
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
            expect(result.data.config).toEqual({ salaryBasis: 'MARGIN', category: null, percent: 5, departmentId: null })
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
            expect(resolvedAgain.data.config).toEqual({ salaryBasis: 'MARGIN', category: null, percent: 5, departmentId: null })
        }
    })

    // Временный костыль (add-department-head-salary-rules) — переопределение отдела плана
    // round-trip'ится через draftFromRule/resolveRuleDraft тем же путём, что и остальные поля.
    it('DepartmentPercent with departmentId override', () => {
        const draft = draftFromRule({
            id: 'rule-dep-2',
            type: 'DepartmentPercent',
            name: 'Процент от маржи (чужой отдел)',
            targetRole: 'DEPARTMENT_HEAD',
            config: { salaryBasis: 'MARGIN', category: null, percent: 5, departmentId: 158 },
        })
        expect(draft.departmentIdOverride).toBe('158')

        const resolvedAgain = resolveRuleDraft(draft)
        expect(resolvedAgain.success).toBe(true)
        if (resolvedAgain.success && resolvedAgain.data.type === 'DepartmentPercent') {
            expect(resolvedAgain.data.config).toEqual({
                salaryBasis: 'MARGIN',
                category: null,
                percent: 5,
                departmentId: 158,
            })
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
