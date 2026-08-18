import { shopSalaryRuleRequestSchema, type ShopSalaryRuleRequest } from 'ireports-contracts'

import { parseNumber, type RuleFieldErrors } from './formNumberUtils.ts'
import { buildOrderPayedAward, buildTaskCompletedAward } from './ruleFormSchema.ts'
import type { RuleDraft } from './ruleDraft.ts'

/**
 * Shop mirror of `ruleFormSchema.ts`'s `resolveRuleDraft` — Фаза 4 (docs/salary-schema-creation-ui).
 * Deliberately a SEPARATE function/file, not a branch inside `resolveRuleDraft`: it validates
 * against `shopSalaryRuleRequestSchema` (`contracts/commands/shop-salary-rule.ts`), a distinct
 * `discriminatedUnion` from the service's `salaryRuleRequestSchema` (see that file's header comment
 * — "issue #57: направления технически не связаны одним объектом"). It reuses two of the service
 * resolver's award builders (`buildOrderPayedAward` for `ProductSold`, `buildTaskCompletedAward` for
 * `TaskCompleted`) because those two award shapes are byte-for-byte identical between the two
 * contracts (see the reuse comment on each) — that is UI-logic reuse, not contract mixing, since the
 * two `safeParse` calls stay fully separate.
 */
export type ResolveShopRuleDraftResult =
    | { success: true; data: ShopSalaryRuleRequest }
    | { success: false; errors: RuleFieldErrors }

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

    const bonusTrimmed = draft.bonus.trim()
    let bonus: number | undefined
    if (bonusTrimmed !== '') {
        const parsedBonus = parseNumber(bonusTrimmed)
        bonus = parsedBonus === undefined ? undefined : Math.round(parsedBonus)
        if (bonus === undefined) errors.bonus = 'Введите целое число'
    }

    let config: unknown
    switch (draft.type) {
        case 'PayPerHour': {
            const price = parseNumber(draft.price)
            if (price === undefined) errors.price = 'Укажите ставку за час'
            config = { price: price ?? Number.NaN, bonus }
            break
        }
        // category — always `string | null` on the draft (see `ruleDraft.ts`'s comment on
        // `RuleDraft.category`), so it's already a valid `productSoldSalaryConfigSchema.category` /
        // `usedProductSoldSalaryConfigSchema.category` value with no extra required-field check.
        case 'ProductSold':
            config = { category: draft.category, award: buildOrderPayedAward(draft, errors), bonus }
            break
        case 'UsedProductSold':
            config = { category: draft.category, award: buildUsedProductSoldAward(draft, errors), bonus }
            break
        case 'TaskCompleted':
            config = { award: buildTaskCompletedAward(draft, errors), bonus }
            break
        default:
            // `draft.type` is the shared `RuleType` union (`ruleDraft.ts`) — the service-only
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
