// Публичное API фичи "Форма зарплатного правила" — направление-агностичное ядро (бывший
// `pages/SalaryRules/core/`) плюс направление-специфичные резолверы/конфиги/справочники (`service/`,
// `shop/`), нужные ОБЕИМ страницам, которые редактируют список правил схемы: созданию
// (`pages/SalaryRules`) и редактированию (`pages/SalaryRuleDetail`). Страница не может
// импортировать другую страницу (frontend/CLAUDE.md), поэтому общая механика вынесена сюда — тот
// же прецедент, что уже есть у `features/TargetDirectory`: у фичи нет единого корневого
// UI-компонента, барель реэкспортирует несколько именованных частей вместо одного default-подобного
// экспорта.
//
// Контракты `SalaryRuleRequest`/`ShopSalaryRuleRequest` (и их `*Response`-версии) никогда не выходят
// за пределы своих направление-специфичных под-барелей ниже — `resolveRuleDraft`/`draftFromRule`
// (service) и `resolveShopRuleDraft`/`draftFromShopRule` (shop) остаются раздельными функциями,
// каждая замкнута на свой `discriminatedUnion` (см. `shop-salary-rule.ts`'s "issue #57").

export { RuleList } from './ui/RuleList'
export type { RuleListProps } from './ui/RuleList'
export { RuleFormCard } from './ui/RuleFormCard'
export type { RuleFormCardContext, RuleFormCardProps } from './ui/RuleFormCard'
export { SchemaNameField } from './ui/SchemaNameField.tsx'
export type { SchemaNameFieldProps } from './ui/SchemaNameField.tsx'

export { createRuleDraft, resetAwardFields, defaultBorders } from './model/ruleDraft.ts'
export type {
    RuleDraft,
    RuleType,
    ServiceRuleType,
    ShopRuleType,
    AwardKind,
    BorderMode,
    BorderDraft,
    SalaryBasisValue,
} from './model/ruleDraft.ts'
export { SALARY_BASIS_LABELS } from './model/ruleFormConfig.ts'
export type { RuleFormConfig, AwardOptionConfig } from './model/ruleFormConfig.ts'
export { useSalaryRulesDraft } from './model/useSalaryRulesDraft.ts'
export type { RuleListState } from './model/useSalaryRulesDraft.ts'
export type { ResolveDraftFn, RuleSaveOutcome } from './model/ruleResolver.ts'
export { useAllowedRolesByType } from './model/useAllowedRolesByType.ts'
export { pluralizeRules, summarizeRuleDraft, summarizeBorders } from './model/ruleSummary.ts'
export { ROLE_LABELS } from './model/roleLabels.ts'

export { resolveRuleDraft, draftFromRule } from './service/model/ruleFormSchema.ts'
export type { RuleFieldErrors, ResolveRuleDraftResult } from './service/model/ruleFormSchema.ts'
export { SERVICE_RULE_FORM_CONFIG, RULE_TYPE_LABELS, RULE_TYPE_ORDER } from './service/model/ruleTypes.ts'
export { useSalaryRuleTypes } from './service/model/useSalaryRuleTypes.ts'
export { useOrderTypes } from './service/model/useOrderTypes.ts'

export { resolveShopRuleDraft, draftFromShopRule } from './shop/model/ruleFormSchema.ts'
export type { ResolveShopRuleDraftResult } from './shop/model/ruleFormSchema.ts'
export { SHOP_RULE_FORM_CONFIG, SHOP_RULE_TYPE_LABELS, SHOP_RULE_TYPE_ORDER } from './shop/model/ruleTypes.ts'
export { useShopSalaryRuleTypes } from './shop/model/useShopSalaryRuleTypes.ts'
export { useCatalog } from './shop/model/useCatalog.ts'
