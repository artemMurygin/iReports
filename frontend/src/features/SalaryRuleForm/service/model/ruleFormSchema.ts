import { salaryRuleRequestSchema, type SalaryRuleRequest, type SalaryRuleResponse } from 'ireports-contracts'

import { parseNumber, type RuleFieldErrors } from '../../model/formNumberUtils.ts'
import { buildOrderPayedAward, buildServiceCompletedAward } from '../../model/ruleAwards.ts'
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
            // replace-bitrix-task-integration, раздел 14 tasks.md — `taskId` приходит от мастера
            // (Шаг 1, `CreateTaskCompletionRuleWizard`), никогда не вводится текстом здесь; пустое
            // значение — защита от регрессии (мастер должен был заполнить его раньше, чем эта форма
            // вообще стала видна), не обычная ошибка пользовательского ввода.
            if (draft.taskId.trim() === '') errors.taskId = 'Задача ещё не создана — пройдите Шаг 1 мастера'
            // `draft.price` переиспользуется под `defaultAmount` (та же семантика "денежное
            // значение, введённое текстом", что и у PayPerHour.config.price выше) — руководитель
            // задаёт сумму по умолчанию при создании правила, а сможет изменить её при проведении
            // начисления (SetTaskRewardModal, `features/SalaryAccruals`).
            const defaultAmount = parseNumber(draft.price)
            if (defaultAmount === undefined) errors.price = 'Укажите сумму начисления по умолчанию'
            // Шаблонные поля (`taskTitleTemplate`/`deadlineTemplate`) обслуживают ТОЛЬКО
            // авто-пересоздание регулярного правила на новый период — для разового правила они
            // структурно всё равно уходят в контракт (`z.string()` допускает `''`), но
            // содержательно не нужны, поэтому required-проверка условна на `isRecurring`
            // (см. `TaskCompletionRuleFields.tsx`, где поля и скрыты при `isRecurring === false`).
            if (draft.isRecurring) {
                if (draft.taskTitleTemplate.trim() === '') {
                    errors.taskTitleTemplate = 'Укажите шаблон заголовка для новой задачи периода'
                }
                if (draft.deadlineTemplate.trim() === '') errors.dueDate = 'Укажите шаблон дедлайна'
            }
            const taskDescriptionTemplate = draft.taskDescriptionTemplate.trim()
            config = {
                taskId: draft.taskId.trim(),
                taskTitleTemplate: draft.taskTitleTemplate.trim(),
                ...(taskDescriptionTemplate !== '' ? { taskDescriptionTemplate } : {}),
                isRecurring: draft.isRecurring,
                deadlineTemplate: draft.deadlineTemplate,
                defaultAmount: defaultAmount ?? Number.NaN,
            }
            break
        }
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
        orderTypeIds: [],
        taskId: '',
        taskTitleTemplate: '',
        taskDescriptionTemplate: '',
        isRecurring: false,
        deadlineTemplate: '',
    }

    switch (rule.type) {
        case 'PayPerHour':
            return { ...base, price: String(rule.config.price) }

        case 'ServiceCompleted': {
            const award = rule.config.award
            const withAward: RuleDraft = { ...base, awardKind: award.type, orderTypeIds: rule.config.orderTypeIds ?? [] }
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
            const withAward: RuleDraft = { ...base, awardKind: award.type, orderTypeIds: rule.config.orderTypeIds ?? [] }
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
                // Ответ API отдаёт только `taskIdByPeriod` (design.md решение 2), не сам `taskId`
                // (тот — одноразовый вход, относящийся к периоду ИЗ ЗАПРОСА, см.
                // `contracts/commands/salary-rule.ts`'s `taskCompletionSalaryConfigResponseSchema`)
                // — редактирование существующего правила переиспользует id ПОСЛЕДНЕГО периода,
                // за который задача уже заводилась (см. `latestTaskId`), а не заново проводит
                // пользователя через Шаг 1 мастера ради задачи, которая уже существует.
                taskId: latestTaskId(rule.config.taskIdByPeriod),
                taskTitleTemplate: rule.config.taskTitleTemplate,
                taskDescriptionTemplate: rule.config.taskDescriptionTemplate ?? '',
                isRecurring: rule.config.isRecurring,
                deadlineTemplate: rule.config.deadlineTemplate,
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
