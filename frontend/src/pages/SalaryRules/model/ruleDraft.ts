import type { TargetRole } from 'ireports-contracts'

/**
 * The 4 service rule types from `contracts/commands/salary-rule.ts`'s `salaryRuleRequestSchema`
 * discriminated union (`PayPerHour`/`ServiceCompleted`/`OrderPayed`/`TaskCompleted`) — Фаза 3
 * (docs/salary-schema-creation-ui) implements all four, replacing Фаза 2's `PayPerHour`-only Step 2.
 */
export type ServiceRuleType = 'PayPerHour' | 'ServiceCompleted' | 'OrderPayed' | 'TaskCompleted'

/**
 * The 4 shop rule types from `contracts/commands/shop-salary-rule.ts`'s `shopSalaryRuleRequestSchema`
 * discriminated union (Фаза 4, docs/salary-schema-creation-ui) — `PayPerHour`/`TaskCompleted` share
 * their literal name with the service union (same word, two separate contract discriminants, see
 * that file's header comment on why this is safe), `ProductSold`/`UsedProductSold` are shop-only.
 */
export type ShopRuleType = 'PayPerHour' | 'ProductSold' | 'UsedProductSold' | 'TaskCompleted'

/**
 * One flat draft (below) is reused for both directions' rule cards, so this is the union of both —
 * NOT a merged/mixed contract type (that stays strictly separate, see `ruleFormSchema.ts` vs
 * `shopRuleFormSchema.ts`): purely the set of string values `draft.type` can hold while being
 * edited. Which subset is actually offered/valid for the currently selected direction is decided by
 * `RuleFormConfig.ruleTypeOrder` (`model/ruleTypes.ts`/`model/shopRuleTypes.ts`), not by this type.
 */
export type RuleType = ServiceRuleType | ShopRuleType

export const RULE_TYPE_ORDER: ServiceRuleType[] = ['PayPerHour', 'ServiceCompleted', 'OrderPayed', 'TaskCompleted']

export const SHOP_RULE_TYPE_ORDER: ShopRuleType[] = ['PayPerHour', 'ProductSold', 'UsedProductSold', 'TaskCompleted']

/** Union of every `award.type` across the 3 award-bearing rule types — which subset applies to a
 * given `RuleType` is `model/ruleTypes.ts`'s `AWARD_OPTIONS_BY_TYPE`. */
export type AwardKind = 'Fixed' | 'ServiceFixed' | 'ServicePercent' | 'FixedPercent' | 'FloatPercent'

export type BorderMode = 'FIX' | 'LINEAR'

export type SalaryBasisValue = 'REVENUE' | 'MARGIN' | 'SALARY_MINUS_ENGINEER_SALARY'

/** One row of `percentBorders` while being edited — numeric fields stay strings (same "text input,
 * parse on submit" convention as Фаза 2's `rate`, see `SalaryRulesRuleCard.tsx`) so the input can
 * hold transient states like `""`/`"1,"` while typing. */
export type BorderDraft = {
    name: string
    fromPlanPercent: string
    multiplier: string
    mode: BorderMode
}

/**
 * Flat draft for one rule card. Reused as-is across all 4 `RuleType`s (fields irrelevant to the
 * current `type`/`awardKind` are simply unread) rather than 4 separate draft shapes — mirrors
 * `frontend/CLAUDE.md`'s "model-хуки с плоским объектом состояния" spirit: one shape, one set of
 * change handlers, the *rendered* form (`SalaryRulesRuleFormCard`) is what varies by type.
 *
 * `percentBorders` is a plain array (not a fixed 3-tuple) on purpose, even though the UI never
 * offers add/remove controls for it (`ThresholdsEditor` always renders exactly 3 rows) — this
 * keeps the "exactly 3 borders" rule a real runtime check in `model/ruleFormSchema.ts`
 * (`resolveRuleDraft`) instead of something only TypeScript enforces, which is what makes it a
 * meaningful case for the unit test the phase asks for.
 */
export type RuleDraft = {
    draftId: string
    /** Whether this draft was ever accepted via "Сохранить правило" — decides what "Отмена"/
     * collapsing does (see `useSalaryRulesDraft.ts`): a draft added via "Добавить правило" and
     * never confirmed is discarded on cancel/collapse; a confirmed one just collapses. */
    confirmed: boolean
    type: RuleType
    name: string
    targetRole: TargetRole | ''
    /** `individualBonusFieldSchema` — optional integer bonus, present on every rule type's config. */
    bonus: string
    /** `PayPerHour.config.price` and award `Fixed.price` share this field (only one is ever read,
     * depending on `type`/`awardKind`). */
    price: string
    awardKind: AwardKind | ''
    /** `ServicePercent.percent` / `FixedPercent.percent`. */
    percent: string
    /** `FloatPercent.basePercent` (`OrderPayed` only). */
    basePercent: string
    /** `FloatPercent.basePrice` (`TaskCompleted` only). */
    basePrice: string
    salaryBasis: SalaryBasisValue | ''
    percentBorders: BorderDraft[]
    thresholdsExpanded: boolean
    /** `ProductSold.config.category` / `UsedProductSold.config.category` (Фаза 4, shop only) — id of
     * a `MoySkladProductFolder` node, or `null` for "все категории". Contract-required (nullable,
     * never absent — see `contracts/commands/shop-salary-rule.ts`), so the draft always carries a
     * value; `null` is the deliberate default (see `createRuleDraft`), not an unset/error state. Read
     * only for `ProductSold`/`UsedProductSold`; ignored otherwise. */
    category: string | null
}

/** Default 3 threshold rows — pre-filled with the mockup's own example values (`design/
 * sallary-first-iteration.pen`, node `l0o4nP`) as a sensible starting template a user overwrites,
 * rather than empty rows for a field with no natural zero-default. */
export function defaultBorders(): BorderDraft[] {
    return [
        { name: 'Ниже плана', fromPlanPercent: '0', multiplier: '0.6', mode: 'LINEAR' },
        { name: 'Выполнение плана', fromPlanPercent: '80', multiplier: '1', mode: 'LINEAR' },
        { name: 'Перевыполнение', fromPlanPercent: '110', multiplier: '1.4', mode: 'FIX' },
    ]
}

export function createRuleDraft(type: RuleType = 'PayPerHour'): RuleDraft {
    return {
        draftId: crypto.randomUUID(),
        confirmed: false,
        type,
        name: '',
        targetRole: '',
        bonus: '',
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
}

/** Switching "Тип правила" clears every award-specific field (the previous type's `awardKind`/
 * price/percent/etc. have no meaning under the new type) but keeps `name` — the role is reset by
 * the caller only if it falls outside the new type's `allowedRoles` (`SalaryRulesRuleFormCard`),
 * not unconditionally here, since `resetAwardFields` doesn't know the allowed-roles list. */
export function resetAwardFields(draft: RuleDraft, nextType: RuleType): RuleDraft {
    return {
        ...draft,
        type: nextType,
        awardKind: '',
        price: '',
        percent: '',
        basePercent: '',
        basePrice: '',
        salaryBasis: '',
        percentBorders: defaultBorders(),
        thresholdsExpanded: false,
        category: null,
    }
}
