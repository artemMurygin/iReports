import type { SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'
import { SHOP_RULE_TYPE_LABELS } from '@/kernel/ruleTypeLabels.ts'

import type { ShopRuleType } from '../../model/ruleDraft.ts'
import { SALARY_BASIS_LABELS, type AwardOptionConfig, type RuleFormConfig } from '../../model/ruleFormConfig.ts'

/**
 * Shop mirror of `service/model/ruleTypes.ts` (Фаза 4, docs/salary-schema-creation-ui) — labels/
 * options for the 3 shop rule types from `contracts/commands/shop-salary-rule.ts` (`PayPerHour`/`ProductSold`/
 * `UsedProductSold`). Kept in its own file rather than added to `service/model/ruleTypes.ts`'s
 * records so each direction's constants stay `Record<XRuleType, ...>` — exhaustively type-checked
 * against that direction's own rule-type union, not the shared superset (`core/model/ruleDraft.ts`'s `RuleType`).
 *
 * `SHOP_RULE_TYPE_LABELS` itself moved to `kernel/ruleTypeLabels.ts` (needed by
 * `pages/SalaryRuleList`'s schema-card chips too) — re-exported here so this file's existing
 * consumers keep working unchanged.
 */
export { SHOP_RULE_TYPE_LABELS }

/** Порядок типов в селекте «Тип правила» направления «Магазин» — зеркало
 * `service/model/ruleTypes.ts`'s `RULE_TYPE_ORDER`, живёт в своём направлении. */
export const SHOP_RULE_TYPE_ORDER: ShopRuleType[] = ['PayPerHour', 'ProductSold', 'UsedProductSold']

/** `shopSalaryBasisSchema` (`shop-salary-rule.ts`) — only `REVENUE`/`MARGIN`, no
 * `SALARY_MINUS_ENGINEER_SALARY` (shop has no engineer role/salary, see that schema's comment) —
 * deliberately 2 tabs, not `service/model/ruleTypes.ts`'s 3-tab `SALARY_BASIS_OPTIONS`, even though the mockup's
 * `Basis Tabs` component instance shows all 3 by default (it's the same reusable component as the
 * service form, not re-authored per direction) — the contract, not the raw mockup component, decides
 * how many options are valid here. Reuses `SALARY_BASIS_LABELS`' `REVENUE`/`MARGIN` entries verbatim
 * (same enum values, same Russian labels for both directions). */
export const SHOP_SALARY_BASIS_OPTIONS: SegmentedControlOption<'REVENUE' | 'MARGIN'>[] = [
    { value: 'REVENUE', label: SALARY_BASIS_LABELS.REVENUE },
    { value: 'MARGIN', label: SALARY_BASIS_LABELS.MARGIN },
]

/** Mirrors `contracts/commands/shop-salary-rule.ts`'s per-type award unions exactly:
 * `ProductSold` — `Fixed`/`FixedPercent`/`FloatPercent` (`productSoldSalaryConfigSchema`);
 * `UsedProductSold` — `Fixed`/`FixedPercent` only, no `FloatPercent` (`usedProductSoldSalaryConfigSchema`
 * — the purchaser's reward isn't tied to plan completion). `PayPerHour` has no award at all, same
 * empty-array convention. */
export const SHOP_AWARD_OPTIONS_BY_TYPE: Record<ShopRuleType, AwardOptionConfig[]> = {
    PayPerHour: [],
    ProductSold: [
        { kind: 'Fixed', title: 'Фиксированная сумма', description: 'Одна и та же сумма за проданный товар' },
        { kind: 'FixedPercent', title: 'Фиксированный процент', description: 'Процент от выбранной базы' },
        { kind: 'FloatPercent', title: 'Плавающий процент', description: 'Базовый процент и 3 порога плана' },
    ],
    UsedProductSold: [
        { kind: 'Fixed', title: 'Фиксированная сумма', description: 'Одна и та же сумма за проданное Б/У устройство' },
        { kind: 'FixedPercent', title: 'Фиксированный процент', description: 'Процент от выбранной базы' },
    ],
}

/** The shop rule types whose `config` has a `category` field (`productSoldSalaryConfigSchema`/
 * `usedProductSoldSalaryConfigSchema`) — `core/ui/RuleFormCard` shows the `CategoryField`
 * (node `vtDMA`) only for these two. */
export const SHOP_CATEGORY_RULE_TYPES: ShopRuleType[] = ['ProductSold', 'UsedProductSold']

export const SHOP_RULE_FORM_CONFIG: RuleFormConfig = {
    ruleTypeOrder: SHOP_RULE_TYPE_ORDER,
    ruleTypeLabels: SHOP_RULE_TYPE_LABELS,
    awardOptionsByType: SHOP_AWARD_OPTIONS_BY_TYPE,
    salaryBasisOptions: SHOP_SALARY_BASIS_OPTIONS,
    categoryRuleTypes: SHOP_CATEGORY_RULE_TYPES,
    // Никакой shop-тип правила не фильтрует по RoApp order type (Фаза 5,
    // docs/service-plan-salary-rule-order-category-filter — вне скоупа для shop, см. PRD).
    orderTypeRuleTypes: [],
}
