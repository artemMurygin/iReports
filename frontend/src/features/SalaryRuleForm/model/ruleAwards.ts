import { buildPercentBorders, parseNumber, type RuleFieldErrors } from './formNumberUtils.ts'
import type { RuleDraft } from './ruleDraft.ts'

/**
 * Сборщики объекта `config.award` по вариантам награды — вынесены из
 * `service/model/ruleFormSchema.ts` в ядро, чтобы оба резолвера обращались к ним как к общему коду,
 * а не одно направление к внутренностям другого. Чистое построение plain-JS-объекта из строк
 * черновика: ни один из них не знает ни про `salaryRuleRequestSchema`, ни про
 * `shopSalaryRuleRequestSchema` — финальный `safeParse` делает сам резолвер направления
 * (`service/model/ruleFormSchema.ts` / `shop/model/ruleFormSchema.ts`), поэтому два из трёх
 * переиспользуются магазином без смешивания контрактов (см. комментарии над
 * `buildOrderPayedAward`/`buildTaskCompletedAward`).
 */

export function buildServiceCompletedAward(draft: RuleDraft, errors: RuleFieldErrors): unknown {
    switch (draft.awardKind) {
        case 'Fixed': {
            const price = parseNumber(draft.price)
            if (price === undefined) errors.price = 'Укажите сумму'
            return { type: 'Fixed', price: price ?? Number.NaN }
        }
        case 'ServiceFixed':
            return { type: 'ServiceFixed' }
        case 'ServicePercent': {
            const percent = parseNumber(draft.percent)
            if (percent === undefined) errors.percent = 'Укажите процент'
            return { type: 'ServicePercent', percent: percent ?? Number.NaN }
        }
        default:
            errors.awardKind = 'Выберите вариант награды'
            return { type: 'Fixed', price: Number.NaN }
    }
}

/**
 * Shared (Фаза 4) — `shop/model/ruleFormSchema.ts`'s `resolveShopRuleDraft` reuses this verbatim
 * for `ProductSold`'s award: `productSoldSalaryConfigSchema.award` (`shop-salary-rule.ts`) is the exact
 * same 3-variant shape (`Fixed`/`FixedPercent`/`FloatPercent`, same field names) as
 * `orderPayedSalaryConfigSchema.award` here — this function only builds a plain JS object from the
 * draft's strings, it has no dependency on `salaryRuleRequestSchema`, so reusing it does not mix the
 * two directions' contracts (each resolver still `safeParse`s the built object against its own
 * schema separately, see `formNumberUtils.ts`'s file comment).
 */
export function buildOrderPayedAward(draft: RuleDraft, errors: RuleFieldErrors): unknown {
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
        case 'FloatPercent': {
            const basePercent = parseNumber(draft.basePercent)
            if (basePercent === undefined) errors.basePercent = 'Укажите базовый процент'
            if (!draft.salaryBasis) errors.salaryBasis = 'Выберите базу начисления'
            const percentBorders = buildPercentBorders(draft.percentBorders, errors)
            return {
                type: 'FloatPercent',
                basePercent: basePercent ?? Number.NaN,
                salaryBasis: draft.salaryBasis || 'REVENUE',
                percentBorders,
            }
        }
        default:
            errors.awardKind = 'Выберите вариант награды'
            return { type: 'Fixed', price: Number.NaN }
    }
}

/**
 * Shared (Фаза 4) — `shop/model/ruleFormSchema.ts`'s `resolveShopRuleDraft` reuses this verbatim
 * for `TaskCompleted`: `taskCompletedShopSalaryConfigSchema.award` (`shop-salary-rule.ts`) is an
 * intentional mirror of `taskCompletedSalaryConfigSchema.award` here (same comment in both contract
 * files) — same reuse rationale as `buildOrderPayedAward` above.
 */
export function buildTaskCompletedAward(draft: RuleDraft, errors: RuleFieldErrors): unknown {
    switch (draft.awardKind) {
        case 'Fixed': {
            const price = parseNumber(draft.price)
            if (price === undefined) errors.price = 'Укажите сумму'
            return { type: 'Fixed', price: price ?? Number.NaN }
        }
        case 'FloatPercent': {
            const basePrice = parseNumber(draft.basePrice)
            if (basePrice === undefined) errors.basePrice = 'Укажите базовую ставку'
            const percentBorders = buildPercentBorders(draft.percentBorders, errors)
            return { type: 'FloatPercent', basePrice: basePrice ?? Number.NaN, percentBorders }
        }
        default:
            errors.awardKind = 'Выберите вариант награды'
            return { type: 'Fixed', price: Number.NaN }
    }
}
