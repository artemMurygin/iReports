import { salaryRuleRequestSchema, type SalaryRuleRequest, type SalaryRuleResponse } from 'ireports-contracts'

import { parseNumber, type RuleFieldErrors } from '../../model/formNumberUtils.ts'
import { buildOrderPayedAward, buildServiceCompletedAward, buildTaskCompletedAward } from '../../model/ruleAwards.ts'
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
            config = { award: buildServiceCompletedAward(draft, errors) }
            break
        case 'OrderPayed':
            config = { award: buildOrderPayedAward(draft, errors) }
            break
        case 'TaskCompleted':
            config = { award: buildTaskCompletedAward(draft, errors) }
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
 * ответа сознательно отбрасывается: `RuleDraft` его не хранит — `PATCH` заменяет весь набор правил
 * направления целиком ("rename + replace all rules of THIS direction", см. apiDesign плана), так что
 * фронту не нужно помнить id отдельного правила, чтобы его отредактировать. `confirmed: true` — черновик
 * уже сохранён на бэкенде, значит для `useSalaryRulesDraft`'s инварианта он не "новый неподтверждённый",
 * а обычный подтверждённый ряд списка (см. `core/model/useSalaryRulesDraft.ts`'s комментарий).
 */
export function draftFromRule(rule: SalaryRuleResponse): RuleDraft {
    const base: RuleDraft = {
        draftId: crypto.randomUUID(),
        confirmed: true,
        type: rule.type,
        name: rule.name,
        targetRole: rule.targetRole,
        price: '',
        awardKind: '',
        percent: '',
        basePercent: '',
        basePrice: '',
        salaryBasis: '',
        percentBorders: defaultBorders(),
        thresholdsExpanded: false,
        category: null,
    }

    switch (rule.type) {
        case 'PayPerHour':
            return { ...base, price: String(rule.config.price) }

        case 'ServiceCompleted': {
            const award = rule.config.award
            const withAward: RuleDraft = { ...base, awardKind: award.type }
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
            const withAward: RuleDraft = { ...base, awardKind: award.type }
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

        case 'TaskCompleted': {
            const award = rule.config.award
            const withAward: RuleDraft = { ...base, awardKind: award.type }
            switch (award.type) {
                case 'Fixed':
                    return { ...withAward, price: String(award.price) }
                case 'FloatPercent':
                    return {
                        ...withAward,
                        basePrice: String(award.basePrice),
                        percentBorders: bordersFromResponse(award.percentBorders),
                    }
            }
            break
        }
    }

    return base
}
