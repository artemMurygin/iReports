import {
    shopSalaryRuleRequestSchema,
    type ShopSalaryRuleRequest,
    type ShopSalaryRuleResponse,
} from 'ireports-contracts'

import { parseNumber, type RuleFieldErrors } from '../../model/formNumberUtils.ts'
import { buildOrderPayedAward } from '../../model/ruleAwards.ts'
import { defaultBorders, type BorderDraft, type RuleDraft } from '../../model/ruleDraft.ts'

/**
 * Shop mirror of `service/model/ruleFormSchema.ts`'s `resolveRuleDraft` — Фаза 4 (docs/salary-schema-creation-ui).
 * Deliberately a SEPARATE function/file, not a branch inside `resolveRuleDraft`: it validates
 * against `shopSalaryRuleRequestSchema` (`contracts/commands/shop-salary-rule.ts`), a distinct
 * `discriminatedUnion` from the service's `salaryRuleRequestSchema` (see that file's header comment
 * — "issue #57: направления технически не связаны одним объектом"). It reuses one of the core's
 * builders (`core/model/ruleAwards.ts` — `buildOrderPayedAward` for `ProductSold`'s award) because
 * that shape is byte-for-byte identical between the two contracts (see the reuse comment there) —
 * that is UI-logic reuse, not contract mixing, since the two `safeParse` calls stay fully separate.
 */
export type ResolveShopRuleDraftResult =
    { success: true; data: ShopSalaryRuleRequest } | { success: false; errors: RuleFieldErrors }

/** `usedProductSoldSalaryConfigSchema.award` (`shop-salary-rule.ts`) — `Fixed`/`FixedPercent` only,
 * no `FloatPercent`: the purchaser's reward isn't tied to plan completion (see that schema's
 * comment), so this can't reuse `buildOrderPayedAward` wholesale like `ProductSold` does. */
function buildUsedProductSoldAward(draft: RuleDraft, errors: RuleFieldErrors): unknown {
    switch (draft.awardKind) {
        case 'Fixed': {
            const price = parseNumber(draft.price)
            if (price === undefined) errors.price = 'Укажите сумму'
            return { type: 'Fixed', price: price ?? Number.NaN }
        }
        case 'FixedPercent': {
            const percent = parseNumber(draft.percent)
            if (percent === undefined) errors.percent = 'Укажите процент'
            if (!draft.salaryBasis) errors.salaryBasis = 'Выберите базу начисления'
            return { type: 'FixedPercent', percent: percent ?? Number.NaN, salaryBasis: draft.salaryBasis || 'REVENUE' }
        }
        default:
            errors.awardKind = 'Выберите вариант награды'
            return { type: 'Fixed', price: Number.NaN }
    }
}

export function resolveShopRuleDraft(draft: RuleDraft): ResolveShopRuleDraftResult {
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
        // category — always `string | null` on the draft (see `core/model/ruleDraft.ts`'s comment on
        // `RuleDraft.category`), so it's already a valid `productSoldSalaryConfigSchema.category` /
        // `usedProductSoldSalaryConfigSchema.category` value with no extra required-field check.
        case 'ProductSold':
            config = { category: draft.category, award: buildOrderPayedAward(draft, errors) }
            break
        case 'UsedProductSold':
            config = { category: draft.category, award: buildUsedProductSoldAward(draft, errors) }
            break
        default:
            // `draft.type` is the shared `RuleType` union (`core/model/ruleDraft.ts`) — the service-only
            // literals (`ServiceCompleted`/`OrderPayed`) never reach this resolver in practice (the
            // shop form's "Тип правила" select only ever offers `SHOP_RULE_TYPE_ORDER`), this branch
            // only guards against a future UI regression.
            errors.name = 'Недопустимый тип правила для направления «Магазин»'
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

    const parsed = shopSalaryRuleRequestSchema.safeParse(candidate)
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
 * Shop mirror of `service/model/ruleFormSchema.ts`'s `draftFromRule` — обратное преобразование
 * `resolveShopRuleDraft` для предзаполнения формы редактирования (`pages/SalaryRuleDetail`, shop
 * направление). `category` (`ProductSold`/`UsedProductSold`) переносится как есть — та же `string |
 * null`, что уже хранит `RuleDraft.category` (см. `core/model/ruleDraft.ts`'s комментарий).
 */
export function draftFromShopRule(rule: ShopSalaryRuleResponse): RuleDraft {
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
        salaryBasis: '',
        percentBorders: defaultBorders(),
        thresholdsExpanded: false,
        category: rule.type === 'ProductSold' || rule.type === 'UsedProductSold' ? rule.config.category : null,
        // orderTypeIds — сервисное поле (`OrderPayed`/`ServiceCompleted`, Фаза 5,
        // docs/service-plan-salary-rule-order-category-filter), ни один shop-тип его не имеет.
        orderTypeIds: [],
    }

    switch (rule.type) {
        case 'PayPerHour':
            return { ...base, price: String(rule.config.price) }

        case 'ProductSold': {
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

        case 'UsedProductSold': {
            const award = rule.config.award
            const withAward: RuleDraft = { ...base, awardKind: award.type }
            switch (award.type) {
                case 'Fixed':
                    return { ...withAward, price: String(award.price) }
                case 'FixedPercent':
                    return { ...withAward, percent: String(award.percent), salaryBasis: award.salaryBasis }
            }
            break
        }
    }

    return base
}
