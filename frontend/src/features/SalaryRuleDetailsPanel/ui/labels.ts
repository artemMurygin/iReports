import type { SalesDirection, TargetRole } from 'ireports-contracts'

/**
 * add-task-salary-rule-links-comments, tasks.md группа 29 — короткие человекочитаемые лейблы для
 * `SalaryRuleSummaryCard`. `ROLE_LABELS`/`DIRECTION_LABEL` уже существуют как локальные карты в
 * других местах (`features/SalaryRuleForm/model/roleLabels.ts`, `TaskStatusCard.tsx`'s
 * `DIRECTION_LABEL`), но кросс-импорт между `features/*` запрещён линтингом (frontend/CLAUDE.md),
 * поэтому здесь — собственная копия, тот же паттерн, что уже применён для `DIRECTION_LABEL` в
 * `TaskStatusCard.tsx` (локальная константа рядом с местом использования, а не общий модуль ради
 * одной маленькой карты).
 */
export const ROLE_LABELS: Record<TargetRole, string> = {
    ENGINEER: 'Инженер',
    ONLINE_MANAGER: 'Онлайн-менеджер',
    OFFLINE_MANAGER: 'Офлайн-менеджер',
    ORDER_MANAGER: 'Менеджер заказов',
    ONLINE_PURCHASER: 'Онлайн-закупщик',
    OFFLINE_PURCHASER: 'Офлайн-закупщик',
    OFFICE: 'Офис',
    SOLO_MANAGER: 'Соло-менеджер',
}

export const DIRECTION_LABEL: Record<SalesDirection, string> = {
    service: 'Сервис',
    shop: 'Шоп',
}
