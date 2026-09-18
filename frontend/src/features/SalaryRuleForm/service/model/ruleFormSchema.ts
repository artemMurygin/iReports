import { salaryRuleRequestSchema, type SalaryRuleRequest, type SalaryRuleResponse } from 'ireports-contracts'

import { isValidPeriod } from '@/shared/lib/format.ts'

import { normalizeDeadlineDayTemplate, parseNumber, type RuleFieldErrors } from '../../model/formNumberUtils.ts'
import {
    buildDepartmentPercentConfig,
    buildDepartmentPlanBonusConfig,
    buildDepartmentTurnoverBonusConfig,
    buildOrderPayedAward,
    buildServiceCompletedAward,
} from '../../model/ruleAwards.ts'
import { defaultBorders, type BorderDraft, type RuleDraft } from '../../model/ruleDraft.ts'

// Re-exported so existing imports (`core/ui/RuleFormCard`, `core/ui/RuleList`,
// `core/model/useSalaryRulesDraft.ts`) keep working unchanged after the type moved to
// `core/model/formNumberUtils.ts` (Фаза 4) to be shared with `shop/model/ruleFormSchema.ts`.
export type { RuleFieldErrors } from '../../model/formNumberUtils.ts'

export type ResolveRuleDraftResult =
    { success: true; data: SalaryRuleRequest } | { success: false; errors: RuleFieldErrors }

/**
 * The rule form's "zod-резолвер": turns one `RuleDraft` (all-strings UI state) into the exact
 * `SalaryRuleRequest` shape the backend expects, or a per-field error map. Field-presence checks
 * (required price/percent/salaryBasis/exactly-3-borders) run first and short-circuit before ever
 * calling into zod — `salaryRuleRequestSchema.safeParse` runs last, as a final structural
 * safety net (reusing the *exact* schema `POST /v1/service/motivation-schema` validates against,
 * per `frontend/CLAUDE.md`'s "не нужно вручную создавать дублирующие типы для API payload'ов"),
 * not the primary source of field errors — its messages are generic/positional and not worth
 * showing next to a specific input.
 */
export function resolveRuleDraft(draft: RuleDraft): ResolveRuleDraftResult {
    const errors: RuleFieldErrors = {}

    if (draft.name.trim().length === 0) errors.name = 'Укажите название правила'
    if (!draft.targetRole) errors.targetRole = 'Выберите роль'

    let config: unknown
    switch (draft.type) {
        case 'PayPerHour': {
            const price = parseNumber(draft.price)
            if (price === undefined) errors.price = 'Укажите ставку за час'
            config = { price: price ?? Number.NaN }
            break
        }
        case 'ServiceCompleted':
            config = { award: buildServiceCompletedAward(draft, errors), orderTypeIds: draft.orderTypeIds }
            break
        case 'OrderPayed':
            config = { award: buildOrderPayedAward(draft, errors), orderTypeIds: draft.orderTypeIds }
            break
        case 'TaskCompletion': {
            // add-task-salary-rule-accounting-period — расчётный период больше не вычисляется
            // неявно на бэкенде (`Period.current()`), руководитель обязан выбрать его в форме
            // (`PeriodPicker`, `TaskCompletionRuleFields.tsx`).
            if (!isValidPeriod(draft.accountingPeriod)) errors.accountingPeriod = 'Выберите расчётный период'
            // `draft.price` переиспользуется под `defaultAmount` (та же семантика "денежное
            // значение, введённое текстом", что и у PayPerHour.config.price выше) — руководитель
            // задаёт сумму по умолчанию при создании правила, а сможет изменить её при проведении
            // начисления (SetTaskRewardModal, `features/SalaryAccruals`).
            const defaultAmount = parseNumber(draft.price)
            if (defaultAmount === undefined) errors.price = 'Укажите сумму начисления по умолчанию'

            if (draft.isRecurring) {
                // Шаблонные поля обслуживают авто-пересоздание регулярного правила на новый период
                // — обязательны только для этого сценария (см. `TaskCompletionRuleFields.tsx`, где
                // поля показаны лишь при `isRecurring === true`).
                if (draft.taskTitleTemplate.trim() === '') {
                    errors.taskTitleTemplate = 'Укажите шаблон заголовка для новой задачи периода'
                }
                if (draft.deadlineTemplate.trim() === '') errors.dueDate = 'Укажите шаблон дедлайна'
                // recurring-task-deadline-offset, FR1 — «Дедлайн относится к» (0 — этому периоду,
                // 1..3 — на 1..3 периода вперёд). Драфт всегда несёт число (default 0, см.
                // `createRuleDraft`), поэтому проверка структурная (регрессия UI-контрола).
                if (
                    !Number.isInteger(draft.deadlinePeriodOffset) ||
                    draft.deadlinePeriodOffset < 0 ||
                    draft.deadlinePeriodOffset > 3
                ) {
                    errors.deadlinePeriodOffset = 'Смещение периода дедлайна должно быть от 0 до 3'
                }
                const taskDescriptionTemplate = draft.taskDescriptionTemplate.trim()
                config = {
                    isRecurring: true,
                    accountingPeriod: draft.accountingPeriod,
                    taskTitleTemplate: draft.taskTitleTemplate.trim(),
                    ...(taskDescriptionTemplate !== '' ? { taskDescriptionTemplate } : {}),
                    deadlineTemplate: normalizeDeadlineDayTemplate(draft.deadlineTemplate),
                    deadlinePeriodOffset: draft.deadlinePeriodOffset,
                    taskLinkTemplates: draft.taskLinkTemplates,
                    createTaskForCurrentPeriod: draft.createTaskForCurrentPeriod,
                    defaultAmount: defaultAmount ?? Number.NaN,
                }
            } else {
                // split-task-completion-rule-form — буквальные поля задачи обязательны, только
                // пока задача ещё не создана (`draft.taskId === ''`, новое разовое правило); для
                // уже существующего (персистентного) разового правила эта форма их больше не
                // показывает и не трогает — задача создаётся один раз, тем же запросом, что и
                // правило.
                const isNewTask = draft.taskId.trim() === ''
                if (isNewTask) {
                    if (draft.taskTitle.trim() === '') errors.taskTitle = 'Укажите название задачи'
                    if (draft.taskDeadline.trim() === '') errors.taskDeadline = 'Укажите дедлайн задачи'
                }
                const taskDescription = draft.taskDescription.trim()
                config = {
                    isRecurring: false,
                    accountingPeriod: draft.accountingPeriod,
                    defaultAmount: defaultAmount ?? Number.NaN,
                    ...(isNewTask
                        ? {
                              taskTitle: draft.taskTitle.trim(),
                              ...(taskDescription !== '' ? { taskDescription } : {}),
                              taskDeadline: draft.taskDeadline,
                              taskLinks: draft.taskLinks,
                          }
                        : {}),
                }
            }
            break
        }
        // add-department-head-salary-rules, FR2-FR4 — 3 новых вида уровня отдела/направления
        // (design.md Decision 2): не транзакционные, без `awardKind`-ветки, config строится целиком
        // общими билдерами из `core/model/ruleAwards.ts` (переиспользуются `shop/model/ruleFormSchema.ts`,
        // см. их комментарий).
        case 'DepartmentPercent':
            config = buildDepartmentPercentConfig(draft, errors)
            break
        case 'DepartmentPlanBonus':
            config = buildDepartmentPlanBonusConfig(draft, errors)
            break
        case 'DepartmentTurnoverBonus':
            // 'number' — service.config.warehouseId — RoApp/RemOnline warehouse id (см.
            // `departmentTurnoverBonusSalaryConfigSchema`, `contracts/commands/salary-rule.ts`).
            config = buildDepartmentTurnoverBonusConfig(draft, errors, 'number')
            break
        default:
            // `draft.type` is the shared `RuleType` union (Фаза 4, `core/model/ruleDraft.ts`) — the shop-only
            // literals (`ProductSold`/`UsedProductSold`) never reach this resolver in practice (the
            // service form's "Тип правила" select only ever offers `RULE_TYPE_ORDER`), this branch
            // only guards against a future UI regression, same spirit as the `buildXAward` helpers'
            // own `default` cases above.
            errors.name = 'Недопустимый тип правила для направления «Сервис»'
            config = {}
            break
    }

    if (Object.keys(errors).length > 0) {
        return { success: false, errors }
    }

    const candidate = {
        // `ruleId` только когда задан — draft.ruleId отсутствует у нового
        // правила ("Добавить правило"), явный `id: undefined` в объекте
        // ломает `salaryRuleRequestSchema.safeParse` для discriminatedUnion
        // с `.optional()`-полем иначе, чем полное отсутствие ключа (см.
        // `RuleDraft.ruleId`'s комментарий — зачем это поле вообще нужно).
        ...(draft.ruleId ? { id: draft.ruleId } : {}),
        type: draft.type,
        name: draft.name.trim(),
        targetRole: draft.targetRole,
        config,
    }

    const parsed = salaryRuleRequestSchema.safeParse(candidate)
    if (!parsed.success) {
        return { success: false, errors: { name: parsed.error.issues[0]?.message ?? 'Некорректные данные правила' } }
    }

    return { success: true, data: parsed.data }
}

function bordersFromResponse(
    borders: readonly { name: string; fromPlanPercent: number; multiplier: number; mode: 'FIX' | 'LINEAR' }[],
): BorderDraft[] {
    return borders.map((border) => ({
        name: border.name,
        fromPlanPercent: String(border.fromPlanPercent),
        multiplier: String(border.multiplier),
        mode: border.mode,
    }))
}

/**
 * Обратное преобразование `resolveRuleDraft` — уже существующее правило (`GET .../motivation-schema/:id`,
 * `rules[]`) в `RuleDraft` для предзаполнения формы редактирования (`pages/SalaryRuleDetail`). `id`
 * ответа переносится в `draft.ruleId` (не отбрасывается — см. `RuleDraft.ruleId`'s комментарий:
 * `PATCH` теперь диффит набор правил по id, а не заменяет его целиком, иначе задача Bitrix24 у
 * TaskCompletion пересоздавалась бы при каждом сохранении формы). `confirmed: true` — черновик
 * уже сохранён на бэкенде, значит для `useSalaryRulesDraft`'s инварианта он не "новый неподтверждённый",
 * а обычный подтверждённый ряд списка (см. `core/model/useSalaryRulesDraft.ts`'s комментарий).
 */
export function draftFromRule(rule: SalaryRuleResponse): RuleDraft {
    const base: RuleDraft = {
        draftId: crypto.randomUUID(),
        ruleId: rule.id,
        confirmed: true,
        type: rule.type,
        name: rule.name,
        targetRole: rule.targetRole,
        price: '',
        awardKind: '',
        percent: '',
        basePercent: '',
        salaryBasis: '',
        percentBorders: defaultBorders(),
        thresholdsExpanded: false,
        category: null,
        departmentIdOverride: '',
        orderTypeIds: [],
        taskId: '',
        taskTitle: '',
        taskDescription: '',
        taskDeadline: '',
        taskLinks: [],
        accountingPeriod: '',
        taskTitleTemplate: '',
        taskDescriptionTemplate: '',
        isRecurring: false,
        deadlineTemplate: '',
        deadlinePeriodOffset: 0,
        taskLinkTemplates: [],
        createTaskForCurrentPeriod: true,
        warehouseId: '',
        planTurnoverRatio: '',
        marginThreshold: '',
        floorAmount: '',
        lowMarginPercent: '',
    }

    switch (rule.type) {
        case 'PayPerHour':
            return { ...base, price: String(rule.config.price) }

        case 'ServiceCompleted': {
            const award = rule.config.award
            const withAward: RuleDraft = {
                ...base,
                awardKind: award.type,
                orderTypeIds: rule.config.orderTypeIds ?? [],
            }
            switch (award.type) {
                case 'Fixed':
                    return { ...withAward, price: String(award.price) }
                case 'ServiceFixed':
                    return withAward
                case 'ServicePercent':
                    return { ...withAward, percent: String(award.percent) }
            }
            break
        }

        case 'OrderPayed': {
            const award = rule.config.award
            const withAward: RuleDraft = {
                ...base,
                awardKind: award.type,
                orderTypeIds: rule.config.orderTypeIds ?? [],
            }
            switch (award.type) {
                case 'Fixed':
                    return { ...withAward, price: String(award.price) }
                case 'FixedPercent':
                    return { ...withAward, percent: String(award.percent), salaryBasis: award.salaryBasis }
                case 'FloatPercent':
                    return {
                        ...withAward,
                        basePercent: String(award.basePercent),
                        salaryBasis: award.salaryBasis,
                        percentBorders: bordersFromResponse(award.percentBorders),
                    }
            }
            break
        }

        case 'TaskCompletion':
            return {
                ...base,
                price: String(rule.config.defaultAmount),
                // Ответ API отдаёт только `taskIdByPeriod`, не буквальные поля задачи (одноразовый
                // вход, split-task-completion-rule-form) — редактирование существующего правила
                // переиспользует id ПОСЛЕДНЕГО периода, за который задача уже заводилась (см.
                // `latestTaskId`); при непустом `taskId` `TaskCompletionRuleFields.tsx` больше не
                // показывает буквальные поля задачи вовсе (см. `taskTitle`'s комментарий в
                // `ruleDraft.ts`), поэтому `taskTitle`/`taskDescription`/`taskDeadline`/`taskLinks`
                // остаются дефолтными ('').
                taskId: latestTaskId(rule.config.taskIdByPeriod),
                // add-task-salary-rule-accounting-period, design.md Decision 4 — берётся из ответа
                // API как есть, НЕ пересчитывается на клиенте (`getCurrentPeriod()` — только для
                // нового, ещё не сохранённого правила, см. `createRuleDraft`). Ответ типизирован
                // опциональным (design.md Decision 1 — обратная совместимость с уже
                // персистированными строками до бэкофилла мапером), `''` — тот же "не задано"
                // фоллбэк, что и у `taskDescriptionTemplate` ниже.
                accountingPeriod: rule.config.accountingPeriod ?? '',
                isRecurring: rule.config.isRecurring,
                // Шаблонные поля существуют только в ответе регулярного варианта
                // (`taskCompletionRecurringConfigResponseSchema`) — дефолты выше (`''`/`0`/`[]`) уже
                // подставлены `base`, здесь перезаписываем только когда есть что подставить.
                ...(rule.config.isRecurring
                    ? {
                          taskTitleTemplate: rule.config.taskTitleTemplate,
                          taskDescriptionTemplate: rule.config.taskDescriptionTemplate ?? '',
                          deadlineTemplate: rule.config.deadlineTemplate,
                          // recurring-task-deadline-offset — обратная совместимость с уже
                          // персистированными правилами до бэкофилла.
                          deadlinePeriodOffset: rule.config.deadlinePeriodOffset ?? 0,
                          taskLinkTemplates: rule.config.taskLinkTemplates ?? [],
                      }
                    : {}),
            }

        // add-department-head-salary-rules, FR2-FR4 — обратное преобразование для 3 новых видов
        // (зеркало `buildDepartmentXConfig`'s полей, `core/model/ruleAwards.ts`).
        case 'DepartmentPercent':
            return {
                ...base,
                salaryBasis: rule.config.salaryBasis,
                category: rule.config.category,
                percent: String(rule.config.percent),
                departmentIdOverride:
                    rule.config.departmentId != null ? String(rule.config.departmentId) : '',
            }

        case 'DepartmentPlanBonus':
            return {
                ...base,
                salaryBasis: rule.config.salaryBasis,
                category: rule.config.category,
                price: String(rule.config.fixedAmount),
                percentBorders: bordersFromResponse(rule.config.percentBorders),
                departmentIdOverride:
                    rule.config.departmentId != null ? String(rule.config.departmentId) : '',
            }

        case 'DepartmentTurnoverBonus':
            return {
                ...base,
                category: rule.config.category,
                price: String(rule.config.fixedAmount),
                warehouseId: String(rule.config.warehouseId),
                planTurnoverRatio: String(rule.config.planTurnoverRatio),
                percentBorders: bordersFromResponse(rule.config.percentBorders),
            }
    }

    return base
}

/** Последнее (по порядку вставки — тот же порядок, что и порядок расчётных периодов, т.к. карта
 * только дополняется, см. `buildTaskCompletionConfig` backend) значение `taskIdByPeriod` — id
 * задачи самого недавнего периода, за который она уже заводилась. `''`, если карта пуста (новое,
 * ещё не сохранённое правило — этот путь на практике не используется, `draftFromRule` вызывается
 * только для уже персистентных правил, но пустая карта технически валидна структурно). */
function latestTaskId(taskIdByPeriod: Record<string, string>): string {
    const values = Object.values(taskIdByPeriod)
    return values.length > 0 ? values[values.length - 1] : ''
}
