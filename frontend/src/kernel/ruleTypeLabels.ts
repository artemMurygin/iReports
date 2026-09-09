/**
 * The 4 service rule types from `contracts/commands/salary-rule.ts`'s `salaryRuleRequestSchema`
 * discriminated union (`PayPerHour`/`ServiceCompleted`/`OrderPayed`/`TaskCompletion` — за выполнение
 * задачи Bitrix24, tasks.md раздел 10).
 */
export type ServiceRuleType = 'PayPerHour' | 'ServiceCompleted' | 'OrderPayed' | 'TaskCompletion'

/**
 * The 4 shop rule types from `contracts/commands/shop-salary-rule.ts`'s `shopSalaryRuleRequestSchema`
 * discriminated union — `PayPerHour` shares its literal name with the service union (same word, two
 * separate contract discriminants), `ProductSold`/`UsedProductSold` are shop-only. `TaskCompletion`
 * (tasks.md раздел 21, зеркало раздела 10/20 для `shop`) shares its literal name with the service
 * union too — same reasoning as `PayPerHour`, independent contract discriminant
 * (`taskCompletionShopSalaryRuleSchema`, issue #57).
 */
export type ShopRuleType = 'PayPerHour' | 'ProductSold' | 'UsedProductSold' | 'TaskCompletion'

/**
 * Moved here from `pages/SalaryRules/model/{ruleDraft,ruleTypes,shopRuleTypes}.ts` (originally Фаза
 * 3/4 of docs/salary-schema-creation-ui) so both `pages/SalaryRules` (schema creation) and
 * `pages/SalaryRuleList` (schema list, docs/salary-schema-list-ui) can read the same Russian
 * rule-type labels without a forbidden page→page import (see frontend/CLAUDE.md's layer table:
 * a shared constant belongs in `kernel`). `pages/SalaryRules`'s own files re-export these under
 * their original names so none of that page's existing imports needed to change.
 */

/** "Тип правила" select labels — Pencil `tSYIw`/`TKUBK` shows `OrderPayed` as "Оплата заказа"
 * verbatim; the other two follow the same short, present-tense-noun style and the wording
 * `docs/payroll/prd-payroll-calculation.md` (§2) already uses for each type ("за выполненную
 * услугу"). `TaskCompletion` — node `j6df4e` (`wV3fv`, `Field Тип` → `Value`) shows "За
 * выполнение задачи" verbatim. */
export const RULE_TYPE_LABELS: Record<ServiceRuleType, string> = {
    PayPerHour: 'Почасовая оплата',
    ServiceCompleted: 'Выполнение услуги',
    OrderPayed: 'Оплата заказа',
    TaskCompletion: 'За выполнение задачи',
}

/** Node `ZMEof` shows `ProductSold` as "Продажа товара", `UsedProductSold` as "Продажа Б/У товара".
 * `TaskCompletion` — тот же лейбл, что и у сервисного варианта (`RULE_TYPE_LABELS`, node `j6df4e`):
 * ZMEof не показывает отдельного примера этого типа в списке (tasks.md раздел 21 — сверено через
 * `mcp__pencil__execute`), формулировка не завязана на направление. */
export const SHOP_RULE_TYPE_LABELS: Record<ShopRuleType, string> = {
    PayPerHour: 'Почасовая оплата',
    ProductSold: 'Продажа товара',
    UsedProductSold: 'Продажа Б/У товара',
    TaskCompletion: 'За выполнение задачи',
}

/** Merged lookup by rule type string, regardless of direction — `PayPerHour` carries
 * the same label in both maps, so the merge is unambiguous. Used by `pages/SalaryRuleList`'s
 * `SchemaCard` chips, which render a schema's `ruleTypes` without first knowing which direction map
 * each entry belongs to. */
export const ALL_RULE_TYPE_LABELS: Record<ServiceRuleType | ShopRuleType, string> = {
    ...RULE_TYPE_LABELS,
    ...SHOP_RULE_TYPE_LABELS,
}
