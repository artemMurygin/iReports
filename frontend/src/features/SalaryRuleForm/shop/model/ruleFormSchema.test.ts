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

    it('FloatPercentMarginFloor ("Продажа товара Б/У") succeeds with all its own fields plus the FloatPercent fields', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'ProductSold',
                awardKind: 'FloatPercentMarginFloor',
                basePercent: '10',
                salaryBasis: 'MARGIN',
                percentBorders: defaultBorders(),
                category: null,
                marginThreshold: '1000',
                floorAmount: '500',
                lowMarginPercent: '0.5',
            }),
        )
        expect(result.success).toBe(true)
        if (
            result.success &&
            result.data.type === 'ProductSold' &&
            result.data.config.award.type === 'FloatPercentMarginFloor'
        ) {
            expect(result.data.config.award).toEqual({
                type: 'FloatPercentMarginFloor',
                basePercent: 10,
                salaryBasis: 'MARGIN',
                percentBorders: defaultBorders().map((border) => ({
                    name: border.name,
                    fromPlanPercent: Number(border.fromPlanPercent),
                    multiplier: Number(border.multiplier),
                    mode: border.mode,
                })),
                marginThreshold: 1000,
                floorAmount: 500,
                lowMarginPercent: 0.5,
            })
        }
    })

    it('FloatPercentMarginFloor fails when marginThreshold/floorAmount/lowMarginPercent are missing', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'ProductSold',
                awardKind: 'FloatPercentMarginFloor',
                basePercent: '10',
                salaryBasis: 'MARGIN',
                percentBorders: defaultBorders(),
                category: null,
                marginThreshold: '',
                floorAmount: '',
                lowMarginPercent: '',
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.errors.marginThreshold).toBeTruthy()
            expect(result.errors.floorAmount).toBeTruthy()
            expect(result.errors.lowMarginPercent).toBeTruthy()
        }
    })

    it('FloatPercentMarginFloor round-trips through draftFromShopRule', () => {
        const draft = draftFromShopRule({
            id: 'shop-rule-used-1',
            type: 'ProductSold',
            name: 'Продажа товара Б/У',
            targetRole: 'OFFLINE_MANAGER',
            isActive: true,
            config: {
                category: null,
                award: {
                    type: 'FloatPercentMarginFloor',
                    basePercent: 10,
                    salaryBasis: 'MARGIN',
                    percentBorders: [
                        { name: 'Ниже плана', fromPlanPercent: 0, multiplier: 0.5, mode: 'FIX' },
                        { name: 'Выполнение плана', fromPlanPercent: 70, multiplier: 1, mode: 'LINEAR' },
                        { name: 'Перевыполнение', fromPlanPercent: 120, multiplier: 1.2, mode: 'FIX' },
                    ],
                    marginThreshold: 1000,
                    floorAmount: 500,
                    lowMarginPercent: 0.5,
                },
            },
        })
        expect(draft.awardKind).toBe('FloatPercentMarginFloor')
        expect(draft.marginThreshold).toBe('1000')
        expect(draft.floorAmount).toBe('500')
        expect(draft.lowMarginPercent).toBe('0.5')

        const resolvedAgain = resolveShopRuleDraft(draft)
        expect(resolvedAgain.success).toBe(true)
        if (
            resolvedAgain.success &&
            resolvedAgain.data.type === 'ProductSold' &&
            resolvedAgain.data.config.award.type === 'FloatPercentMarginFloor'
        ) {
            expect(resolvedAgain.data.config.award.marginThreshold).toBe(1000)
            expect(resolvedAgain.data.config.award.floorAmount).toBe(500)
            expect(resolvedAgain.data.config.award.lowMarginPercent).toBe(0.5)
        }
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
 * Shop mirror of `service/model/ruleFormSchema.test.ts`'s аналогичный `describe` (другой
 * `targetRole`-справочник, `OFFLINE_MANAGER` вместо `ENGINEER`) — split-task-completion-rule-form,
 * см. его комментарий про смысл каждого сценария и про новую discriminated-union форму `config`.
 */
describe('resolveShopRuleDraft — TaskCompletion', () => {
    it('one-off, new task (taskId === ""): builds the request from the literal task fields', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'TaskCompletion',
                name: 'Провести ревизию склада',
                taskId: '',
                isRecurring: false,
                taskTitle: 'Провести ревизию склада',
                taskDescription: 'Сверить остатки по накладным',
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
                taskTitle: 'Провести ревизию склада',
                taskDescription: 'Сверить остатки по накладным',
                taskDeadline: '2026-09-25',
                taskLinks: [{ url: 'https://example.com/1', label: 'Отчёт' }],
            })
        }
    })

    it('one-off, already-created task (taskId !== ""): sends no literal task fields at all', () => {
        const result = resolveShopRuleDraft(
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
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'TaskCompletion',
                name: 'Провести ревизию склада',
                taskId: 'task-1',
                taskTitleTemplate: 'Провести ревизию склада ({месяц})',
                taskDescriptionTemplate: 'Сверить остатки по накладным',
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
                taskTitleTemplate: 'Провести ревизию склада ({месяц})',
                taskDescriptionTemplate: 'Сверить остатки по накладным',
                // recurring-task-deadline-offset v2 — `resolveShopRuleDraft` нормализует
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
        const result = resolveShopRuleDraft(
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
        const result = resolveShopRuleDraft(
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
        const result = resolveShopRuleDraft(
            baseDraft({ type: 'TaskCompletion', taskId: '', isRecurring: false, price: '5000' }),
        )
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.errors.taskTitle).toBeTruthy()
            expect(result.errors.taskDeadline).toBeTruthy()
        }
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

/**
 * Shop mirror of `service/model/ruleFormSchema.test.ts`'s аналогичный `describe`
 * (recurring-task-deadline-offset, FR1) — тот же контрол «Дедлайн относится к», тот же
 * `RuleDraft.deadlinePeriodOffset` (общий для обеих директоров тип драфта, `core/model/ruleDraft.ts`).
 */
describe('resolveShopRuleDraft — TaskCompletion deadlinePeriodOffset (recurring-task-deadline-offset)', () => {
    it('defaults to 0 on a brand-new RuleDraft', () => {
        expect(createRuleDraft().deadlinePeriodOffset).toBe(0)
    })

    it('resolves a valid deadlinePeriodOffset (1..3) into the request', () => {
        for (const offset of [1, 2, 3]) {
            const result = resolveShopRuleDraft(
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
            const result = resolveShopRuleDraft(
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

describe('draftFromShopRule — TaskCompletion', () => {
    it('round-trips a persisted rule back into a draft usable by resolveShopRuleDraft', () => {
        const draft = draftFromShopRule({
            id: 'shop-rule-1',
            type: 'TaskCompletion',
            name: 'Провести ревизию склада',
            targetRole: 'OFFLINE_MANAGER',
            isActive: true,
            // isRecurring: true response — template fields only exist on this variant (see
            // `taskCompletionRecurringConfigResponseSchema`, `contracts/commands/salary-rule.ts`).
            config: {
                taskTitleTemplate: 'Провести ревизию склада ({месяц})',
                taskDescriptionTemplate: 'Сверить остатки по накладным',
                isRecurring: true,
                deadlineTemplate: '2026-09-25',
                deadlinePeriodOffset: 3,
                defaultAmount: 5000,
                taskIdByPeriod: { '2026-09': 'task-1' },
            },
        })
        expect(draft.type).toBe('TaskCompletion')
        expect(draft.name).toBe('Провести ревизию склада')
        expect(draft.taskId).toBe('task-1')
        expect(draft.taskDescriptionTemplate).toBe('Сверить остатки по накладным')
        expect(draft.isRecurring).toBe(true)
        expect(draft.deadlineTemplate).toBe('2026-09-25')
        // recurring-task-deadline-offset — переносится из ответа как есть.
        expect(draft.deadlinePeriodOffset).toBe(3)
        expect(draft.price).toBe('5000')
        expect(draft.taskLinkTemplates).toEqual([])

        const resolvedAgain = resolveShopRuleDraft(draft)
        expect(resolvedAgain.success).toBe(true)
        // split-task-completion-rule-form — `taskId` is no longer part of the request contract at
        // all (`taskCompletionSalaryConfigRequestSchema` has no `taskId` field, neither variant).
        if (resolvedAgain.success && resolvedAgain.data.type === 'TaskCompletion' && resolvedAgain.data.config.isRecurring) {
            expect(resolvedAgain.data.config.taskDescriptionTemplate).toBe('Сверить остатки по накладным')
            expect(resolvedAgain.data.config.defaultAmount).toBe(5000)
            expect(resolvedAgain.data.config.deadlinePeriodOffset).toBe(3)
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
                deadlinePeriodOffset: 1,
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
                deadlinePeriodOffset: 0,
                defaultAmount: 3000,
                taskIdByPeriod: {},
            },
        })
        expect(draft.taskId).toBe('')
        expect(draft.deadlinePeriodOffset).toBe(0)
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
            expect(result.data.config).toEqual({ salaryBasis: 'MARGIN', category: null, percent: 5, departmentId: null })
        }
    })

    it('fails when percent is missing', () => {
        const result = resolveShopRuleDraft(
            baseDraft({
                type: 'DepartmentPercent',
                targetRole: 'DEPARTMENT_HEAD',
                salaryBasis: 'REVENUE',
                percent: '',
            }),
        )
        expect(result.success).toBe(false)
        if (!result.success) expect(result.errors.percent).toBeTruthy()
    })

    // Временный костыль (add-department-head-salary-rules) — round-trip через
    // draftFromShopRule/resolveShopRuleDraft тем же путём, что и остальные поля (зеркало
    // service/model/ruleFormSchema.test.ts).
    it('departmentId override round-trips through draftFromShopRule/resolveShopRuleDraft', () => {
        const draft = draftFromShopRule({
            id: 'rule-dep-shop-1',
            type: 'DepartmentPercent',
            name: 'Процент от маржи (чужой отдел)',
            targetRole: 'DEPARTMENT_HEAD',
            config: { salaryBasis: 'MARGIN', category: null, percent: 5, departmentId: 158 },
        })
        expect(draft.departmentIdOverride).toBe('158')

        const resolvedAgain = resolveShopRuleDraft(draft)
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
