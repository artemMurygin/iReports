import { salaryRuleRequestSchema, type SalaryRuleRequest } from 'ireports-contracts'

import { buildPercentBorders, parseNumber, type RuleFieldErrors } from './formNumberUtils.ts'
import type { RuleDraft } from './ruleDraft.ts'

// Re-exported so existing imports (`SalaryRulesRuleFormCard.tsx`, `SalaryRulesRuleList.tsx`,
// `useSalaryRulesDraft.ts`) keep working unchanged after the type moved to `formNumberUtils.ts`
// (Фаза 4) to be shared with `shopRuleFormSchema.ts`.
export type { RuleFieldErrors } from './formNumberUtils.ts'

export type ResolveRuleDraftResult =
    | { success: true; data: SalaryRuleRequest }
    | { success: false; errors: RuleFieldErrors }

function buildServiceCompletedAward(draft: RuleDraft, errors: RuleFieldErrors): unknown {
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
 * Exported (Фаза 4) — `shopRuleFormSchema.ts`'s `resolveShopRuleDraft` reuses this verbatim for
 * `ProductSold`'s award: `productSoldSalaryConfigSchema.award` (`shop-salary-rule.ts`) is the exact
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
 * Exported (Фаза 4) — `shopRuleFormSchema.ts`'s `resolveShopRuleDraft` reuses this verbatim for
 * `TaskCompleted`: `taskCompletedShopSalaryConfigSchema.award` (`shop-salary-rule.ts`) is an
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
        case 'ServiceCompleted':
            config = { award: buildServiceCompletedAward(draft, errors), bonus }
            break
        case 'OrderPayed':
            config = { award: buildOrderPayedAward(draft, errors), bonus }
            break
        case 'TaskCompleted':
            config = { award: buildTaskCompletedAward(draft, errors), bonus }
            break
        default:
            // `draft.type` is the shared `RuleType` union (Фаза 4, `ruleDraft.ts`) — the shop-only
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
