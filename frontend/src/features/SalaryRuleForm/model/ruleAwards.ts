import { buildPercentBorders, parseNumber, type RuleFieldErrors } from './formNumberUtils.ts'
import type { RuleDraft } from './ruleDraft.ts'

/**
 * Сборщики `config`/`config.award` по типу правила — вынесены из `service/model/ruleFormSchema.ts`
 * в ядро, чтобы оба резолвера обращались к ним как к общему коду, а не одно направление к
 * внутренностям другого. Чистое построение plain-JS-объекта из строк черновика: ни один из них не
 * знает ни про `salaryRuleRequestSchema`, ни про `shopSalaryRuleRequestSchema` — финальный
 * `safeParse` делает сам резолвер направления (`service/model/ruleFormSchema.ts` /
 * `shop/model/ruleFormSchema.ts`), поэтому переиспользуются магазином без смешивания контрактов
 * (см. комментарий над `buildOrderPayedAward`).
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
 * Config builders for the 3 department-level rule types (add-department-head-salary-rules,
 * FR2-FR4) — unlike `buildServiceCompletedAward`/`buildOrderPayedAward` above, these build the
 * WHOLE `config` object directly (not an `award` sub-object): design.md Decision 2 models
 * `DepartmentPercent`/`DepartmentPlanBonus`/`DepartmentTurnoverBonus` as types with a single fixed
 * field set each — ui-design.md «Отклонения»: "Блок «Вариант награды» не переиспользован для
 * FR2–FR4" (no `awardKind` selector at all for these 3 types). Shared between
 * `service/model/ruleFormSchema.ts` and `shop/model/ruleFormSchema.ts` for the same reason
 * `buildOrderPayedAward` already is (see its comment) — pure plain-JS-object building with zero
 * dependency on either direction's zod schema, each resolver's own `safeParse` stays the real gate
 * (catches e.g. shop's narrower `shopSalaryBasisSchema` rejecting `SALARY_MINUS_ENGINEER_SALARY`,
 * which these builders don't know or care about).
 */

/** Implements FR2 of add-department-head-salary-rules. `category` — `draft.category` as-is
 * (`string | null`, same "весь склад/направление" convention as `ProductSold`/`UsedProductSold`,
 * see `RuleDraft.category`'s comment) — never a required-field check, `null` is a valid default. */
export function buildDepartmentPercentConfig(draft: RuleDraft, errors: RuleFieldErrors): unknown {
    if (!draft.salaryBasis) errors.salaryBasis = 'Выберите базу начисления'
    const percent = parseNumber(draft.percent)
    if (percent === undefined) errors.percent = 'Укажите процент'
    return {
        salaryBasis: draft.salaryBasis || 'REVENUE',
        category: draft.category,
        percent: percent ?? Number.NaN,
    }
}

/** Implements FR3 of add-department-head-salary-rules. `fixedAmount` reuses `draft.price` (see that
 * field's comment on `RuleDraft`) — same "money as text, parsed on submit" convention as
 * `PayPerHour.config.price`/award `Fixed.price`/`TaskCompletion.config.defaultAmount`.
 * `percentBorders` reuses the same `buildPercentBorders` both award-bearing types already validate
 * against — no new formula, just a 4th caller (design.md Decision 5: reuses the existing
 * `resolveFloatPercentMultiplier`/`percentBorders` mechanism as-is). */
export function buildDepartmentPlanBonusConfig(draft: RuleDraft, errors: RuleFieldErrors): unknown {
    if (!draft.salaryBasis) errors.salaryBasis = 'Выберите базу начисления'
    const fixedAmount = parseNumber(draft.price)
    if (fixedAmount === undefined) errors.price = 'Укажите фиксированную сумму'
    return {
        salaryBasis: draft.salaryBasis || 'REVENUE',
        category: draft.category,
        fixedAmount: fixedAmount ?? Number.NaN,
        percentBorders: buildPercentBorders(draft.percentBorders, errors),
    }
}

/**
 * Implements FR4 of add-department-head-salary-rules. Unlike FR2/FR3, this type has no
 * `salaryBasis` at all (оборачиваемость — не денежная база, см.
 * `departmentTurnoverBonusSalaryConfigSchema`, `contracts/commands/salary-rule.ts`), но заводит
 * собственный обязательный `warehouseId` (design.md Decision 2: оборачиваемость скоуплена по
 * категории × складу, автоматической привязки сотрудник→склад нет, в отличие от `department`) и
 * `planTurnoverRatio` (сам план, хранится прямо в конфиге правила — см. комментарий той схемы).
 *
 * `warehouseIdKind` selects whether `config.warehouseId` is built as a `number` (service, RoApp
 * warehouse id) or kept as the raw trimmed `string` (shop, MoySklad UUID) — the one field whose
 * contract type genuinely differs between directions (see `departmentTurnoverBonusSalaryConfigSchema`
 * vs `departmentTurnoverBonusShopSalaryConfigSchema`'s comments); `service/model/ruleFormSchema.ts`
 * calls this with `'number'`, `shop/model/ruleFormSchema.ts` with `'string'`.
 *
 * `planTurnoverRatio` must be a positive number — mirrors the backend `TurnoverRatioValueObject`
 * invariant (`value > 0`, architecture.md «Value Objects») as an early, friendlier form error rather
 * than only failing much later against a domain invariant the UI never explains.
 */
export function buildDepartmentTurnoverBonusConfig(
    draft: RuleDraft,
    errors: RuleFieldErrors,
    warehouseIdKind: 'number' | 'string',
): unknown {
    let warehouseId: number | string | undefined
    if (warehouseIdKind === 'number') {
        warehouseId = parseNumber(draft.warehouseId)
    } else {
        const trimmed = draft.warehouseId.trim()
        warehouseId = trimmed === '' ? undefined : trimmed
    }
    if (warehouseId === undefined) errors.warehouseId = 'Выберите склад'

    const fixedAmount = parseNumber(draft.price)
    if (fixedAmount === undefined) errors.price = 'Укажите фиксированную сумму'

    const planTurnoverRatio = parseNumber(draft.planTurnoverRatio)
    if (planTurnoverRatio === undefined) {
        errors.planTurnoverRatio = 'Укажите план коэффициента оборачиваемости'
    } else if (planTurnoverRatio <= 0) {
        errors.planTurnoverRatio = 'План коэффициента оборачиваемости должен быть больше нуля'
    }

    return {
        warehouseId: warehouseId ?? (warehouseIdKind === 'number' ? Number.NaN : ''),
        category: draft.category,
        fixedAmount: fixedAmount ?? Number.NaN,
        planTurnoverRatio: planTurnoverRatio ?? Number.NaN,
        percentBorders: buildPercentBorders(draft.percentBorders, errors),
    }
}
