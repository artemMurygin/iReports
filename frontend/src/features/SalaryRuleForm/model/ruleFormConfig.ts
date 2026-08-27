import type { SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'

import type { AwardKind, RuleType, SalaryBasisValue } from './ruleDraft.ts'

/**
 * Направление-агностичная часть конфигурации формы правила: общие лейблы баз начисления и типы,
 * которыми оба направления описывают свой набор типов правил и вариантов награды. Конкретные
 * наборы живут у направлений (`service/model/ruleTypes.ts` — `SERVICE_RULE_FORM_CONFIG`,
 * `shop/model/ruleTypes.ts` — `SHOP_RULE_FORM_CONFIG`), сюда вынесено только то, что не знает ни
 * про сервис, ни про магазин.
 */

export const SALARY_BASIS_LABELS: Record<SalaryBasisValue, string> = {
    REVENUE: 'Выручка',
    MARGIN: 'Маржа',
    SALARY_MINUS_ENGINEER_SALARY: 'Маржа - начисление инженера',
}

export type AwardOptionConfig = {
    kind: AwardKind
    title: string
    description: string
}

/**
 * Bundles everything `core/ui/RuleFormCard`/`core/ui/RuleList` need to render a direction's
 * rule editor without importing direction-specific constants themselves (Фаза 4) — the same
 * component tree is reused for both `service` (`service/model/ruleTypes.ts`'s
 * `SERVICE_RULE_FORM_CONFIG`) and `shop` (`shop/model/ruleTypes.ts`'s `SHOP_RULE_FORM_CONFIG`) by
 * passing a different `RuleFormConfig`, instead of branching on direction inside the shared UI
 * components. `categoryRuleTypes` — the subset of `ruleTypeOrder` that shows the `CategoryField`
 * (Фаза 4, node `vtDMA`) — is empty for service (no service rule type has a category).
 * `orderTypeRuleTypes` (Фаза 5, docs/service-plan-salary-rule-order-category-filter) — the subset
 * that shows the `OrderTypeField` multiselect (`OrderPayed`/`ServiceCompleted`) — is empty for
 * shop (no shop rule type filters by RoApp order type). The two lists never overlap for a given
 * direction, so `core/ui/RuleFormCard` treats them as mutually exclusive.
 */
export type RuleFormConfig = {
    ruleTypeOrder: RuleType[]
    ruleTypeLabels: Partial<Record<RuleType, string>>
    awardOptionsByType: Partial<Record<RuleType, AwardOptionConfig[]>>
    salaryBasisOptions: SegmentedControlOption<SalaryBasisValue>[]
    categoryRuleTypes: RuleType[]
    orderTypeRuleTypes: RuleType[]
}

/**
 * `TaskCompleted` создаёт задачу Bitrix24 с ответственным = сотрудник схемы (change
 * salary-rule-bitrix-task, spec.md "Создание правила-задачи только в схеме на сотрудника") — у
 * схемы отдела нет конкретного исполнителя, поэтому тип недоступен для добавления, когда цель
 * схемы — отдел. Обе точки, что строят финальный `RuleFormConfig` для карточки правила (создание —
 * `pages/SalaryRules/model/useSalaryRulesPage.ts`, редактирование — `useServiceSchemaEditPage.ts`/
 * `useShopSchemaEditPage.ts`), пропускают свой направленческий конфиг через эту функцию с уже
 * известной целью схемы, вместо того чтобы `core/ui/RuleFormCard`'s тип-селект знал о цели схемы
 * сам — `config.ruleTypeOrder` остаётся единственным источником списка типов для селекта
 * (`RuleFormCardFields.tsx`), фильтрация целиком происходит до него. `targetType: null` (цель ещё
 * не выбрана/схема ещё не загружена) не сужает список — те немногие миллисекунды до выбора цели не
 * должны прятать тип, который окажется доступным.
 */
export function restrictRuleFormConfigToTarget(
    config: RuleFormConfig,
    targetType: 'Department' | 'Employee' | null,
): RuleFormConfig {
    if (targetType !== 'Department') return config
    return { ...config, ruleTypeOrder: config.ruleTypeOrder.filter((type) => type !== 'TaskCompleted') }
}
