import type { SegmentedControlOption } from '@/shared/ui-kit/atoms/SegmentedControl'
import { RULE_TYPE_LABELS } from '@/kernel/ruleTypeLabels.ts'

import type { SalaryBasisValue, ServiceRuleType } from '../../model/ruleDraft.ts'
import { SALARY_BASIS_LABELS, type AwardOptionConfig, type RuleFormConfig } from '../../model/ruleFormConfig.ts'

/**
 * `RULE_TYPE_LABELS` moved to `kernel/ruleTypeLabels.ts` (needed by `pages/SalaryRuleList`'s
 * schema-card chips too) — re-exported here so this file's existing consumers keep working
 * unchanged.
 */
export { RULE_TYPE_LABELS }

/** Порядок типов в селекте «Тип правила» направления «Сервис» — живёт здесь, рядом с остальными
 * сервисными наборами, а не в направление-агностичном `core/model/ruleDraft.ts`. `TaskCompletion` —
 * последний в списке (node `j6df4e`, tasks.md раздел 20), тот же порядок, что и в `wV3fv`'s "Тип
 * правила" select. */
export const RULE_TYPE_ORDER: ServiceRuleType[] = ['PayPerHour', 'ServiceCompleted', 'OrderPayed', 'TaskCompletion']

/** Pencil `tSYIw` → `Salary Basis` / `Basis Tabs` — 3-tab segmented control, same shape
 * `SegmentedControl` already renders for "Направление" and the borders' "Режим" tabs. */
export const SALARY_BASIS_OPTIONS: SegmentedControlOption<SalaryBasisValue>[] = [
    { value: 'REVENUE', label: SALARY_BASIS_LABELS.REVENUE },
    { value: 'MARGIN', label: SALARY_BASIS_LABELS.MARGIN },
    { value: 'SALARY_MINUS_ENGINEER_SALARY', label: SALARY_BASIS_LABELS.SALARY_MINUS_ENGINEER_SALARY },
]

/**
 * Which `award.type` variants each `RuleType` offers, and the `RadioCard` copy for each — mirrors
 * `contracts/commands/salary-rule.ts`'s per-type award unions exactly. `PayPerHour` has no
 * award at all (`config` is just `price`), hence the empty array — its own field
 * (`Ставка, ₽/час`) is rendered unconditionally by `core/ui/RuleFormCard`, not through this list.
 * `TaskCompletion` is the same kind of "no award variants" type — its own custom field block
 * (`TaskCompletionRuleFields`) is rendered by `core/ui/RuleFormCard` via `config.showTaskFields`,
 * not through `AwardSection`/this list, same treatment as `PayPerHour`.
 */
export const AWARD_OPTIONS_BY_TYPE: Record<ServiceRuleType, AwardOptionConfig[]> = {
    PayPerHour: [],
    TaskCompletion: [],
    ServiceCompleted: [
        { kind: 'Fixed', title: 'Фиксированная сумма', description: 'Одна и та же сумма за выполненную услугу' },
        {
            kind: 'ServiceFixed',
            title: 'Ставка из справочника услуги',
            description: 'Сумма берётся из карточки услуги в RemOnline',
        },
        {
            kind: 'ServicePercent',
            title: 'Процент от стоимости услуги',
            description: 'Процент от суммы выполненной услуги',
        },
    ],
    OrderPayed: [
        { kind: 'Fixed', title: 'Фиксированная сумма', description: 'Одна и та же сумма за событие' },
        { kind: 'FixedPercent', title: 'Фиксированный процент', description: 'Процент от выбранной базы' },
        { kind: 'FloatPercent', title: 'Плавающий процент', description: 'Базовый процент и 3 порога плана' },
    ],
}

/** The service rule types whose `config` has an `orderTypeIds` field
 * (`orderPayedSalaryConfigSchema`/`serviceCompletedSalaryConfigSchema`, Фаза 5,
 * docs/service-plan-salary-rule-order-category-filter) — `core/ui/RuleFormCard` shows the
 * `OrderTypeField` multiselect only for these two; `PayPerHour` doesn't accept the field at
 * all. */
export const SERVICE_ORDER_TYPE_RULE_TYPES: ServiceRuleType[] = ['OrderPayed', 'ServiceCompleted']

/** `TaskCompletion` — the only service rule type whose body is `TaskCompletionRuleFields`, not
 * `AwardSection` (tasks.md раздел 20, node `wV3fv`/`aS8yc`). */
export const SERVICE_TASK_RULE_TYPES: ServiceRuleType[] = ['TaskCompletion']

export const SERVICE_RULE_FORM_CONFIG: RuleFormConfig = {
    ruleTypeOrder: RULE_TYPE_ORDER,
    ruleTypeLabels: RULE_TYPE_LABELS,
    awardOptionsByType: AWARD_OPTIONS_BY_TYPE,
    salaryBasisOptions: SALARY_BASIS_OPTIONS,
    categoryRuleTypes: [],
    orderTypeRuleTypes: SERVICE_ORDER_TYPE_RULE_TYPES,
    taskRuleTypes: SERVICE_TASK_RULE_TYPES,
}
