import type { SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'

import { RULE_TYPE_ORDER, type AwardKind, type RuleType, type SalaryBasisValue, type ServiceRuleType } from './ruleDraft.ts'

/** "Тип правила" select labels — Pencil `tSYIw`/`TKUBK` shows `OrderPayed` as "Оплата заказа"
 * verbatim; the other three follow the same short, present-tense-noun style and the wording
 * `docs/payroll/prd-payroll-calculation.md` (§2) already uses for each type ("за выполненную
 * услугу"/"за выполненную задачу"). */
export const RULE_TYPE_LABELS: Record<ServiceRuleType, string> = {
    PayPerHour: 'Почасовая оплата',
    ServiceCompleted: 'Выполнение услуги',
    OrderPayed: 'Оплата заказа',
    TaskCompleted: 'Выполнение задачи',
}

export const SALARY_BASIS_LABELS: Record<SalaryBasisValue, string> = {
    REVENUE: 'Выручка',
    MARGIN: 'Маржа',
    SALARY_MINUS_ENGINEER_SALARY: 'Маржа - начисление инженера',
}

/** Pencil `tSYIw` → `Salary Basis` / `Basis Tabs` — 3-tab segmented control, same shape
 * `SegmentedControl` already renders for "Направление" and the borders' "Режим" tabs. */
export const SALARY_BASIS_OPTIONS: SegmentedControlOption<SalaryBasisValue>[] = [
    { value: 'REVENUE', label: SALARY_BASIS_LABELS.REVENUE },
    { value: 'MARGIN', label: SALARY_BASIS_LABELS.MARGIN },
    { value: 'SALARY_MINUS_ENGINEER_SALARY', label: SALARY_BASIS_LABELS.SALARY_MINUS_ENGINEER_SALARY },
]

export type AwardOptionConfig = {
    kind: AwardKind
    title: string
    description: string
}

/**
 * Which `award.type` variants each `RuleType` offers, and the `RadioCard` copy for each — mirrors
 * `contracts/commands/salary-rule.ts`'s per-type award unions exactly (not the plan text's
 * "TaskCompleted: Fixed/FixedPercent/FloatPercent", which doesn't match the contract: `TaskCompleted`
 * has no `FixedPercent` variant — see `taskCompletedSalaryConfigSchema`). `PayPerHour` has no
 * award at all (`config` is just `price`/`bonus`), hence the empty array — its own field
 * (`Ставка, ₽/час`) is rendered unconditionally by `SalaryRulesRuleFormCard`, not through this list.
 */
export const AWARD_OPTIONS_BY_TYPE: Record<ServiceRuleType, AwardOptionConfig[]> = {
    PayPerHour: [],
    ServiceCompleted: [
        { kind: 'Fixed', title: 'Фиксированная сумма', description: 'Одна и та же сумма за выполненную услугу' },
        {
            kind: 'ServiceFixed',
            title: 'Ставка из справочника услуги',
            description: 'Сумма берётся из карточки услуги в RemOnline',
        },
        { kind: 'ServicePercent', title: 'Процент от стоимости услуги', description: 'Процент от суммы выполненной услуги' },
    ],
    OrderPayed: [
        { kind: 'Fixed', title: 'Фиксированная сумма', description: 'Одна и та же сумма за событие' },
        { kind: 'FixedPercent', title: 'Фиксированный процент', description: 'Процент от выбранной базы' },
        { kind: 'FloatPercent', title: 'Плавающий процент', description: 'Базовый процент и 3 порога плана' },
    ],
    TaskCompleted: [
        { kind: 'Fixed', title: 'Фиксированная сумма', description: 'Одна и та же сумма за выполненную задачу' },
        { kind: 'FloatPercent', title: 'Плавающий процент', description: 'Базовая ставка и 3 порога плана' },
    ],
}

/**
 * Bundles everything `SalaryRulesRuleFormCard`/`SalaryRulesRuleList` need to render a direction's
 * rule editor without importing direction-specific constants themselves (Фаза 4) — the same
 * component tree is reused for both `service` (this constant) and `shop`
 * (`shopRuleTypes.ts`'s `SHOP_RULE_FORM_CONFIG`) by passing a different `RuleFormConfig`, instead of
 * branching on direction inside the shared UI components. `categoryRuleTypes` — the subset of
 * `ruleTypeOrder` that shows the `CategoryCombobox` field (Фаза 4, node `vtDMA`) — is empty for
 * service (no service rule type has a category).
 */
export type RuleFormConfig = {
    ruleTypeOrder: RuleType[]
    ruleTypeLabels: Partial<Record<RuleType, string>>
    awardOptionsByType: Partial<Record<RuleType, AwardOptionConfig[]>>
    salaryBasisOptions: SegmentedControlOption<SalaryBasisValue>[]
    categoryRuleTypes: RuleType[]
}

export const SERVICE_RULE_FORM_CONFIG: RuleFormConfig = {
    ruleTypeOrder: RULE_TYPE_ORDER,
    ruleTypeLabels: RULE_TYPE_LABELS,
    awardOptionsByType: AWARD_OPTIONS_BY_TYPE,
    salaryBasisOptions: SALARY_BASIS_OPTIONS,
    categoryRuleTypes: [],
}
