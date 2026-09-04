import type { TargetRole } from 'ireports-contracts'

import { ALL_RULE_TYPE_LABELS } from '@/kernel/ruleTypeLabels.ts'

/**
 * Человекочитаемые роли (`targetRole`) для отчёта по зарплате — своя копия для этого модуля (не
 * реэкспорт `features/SalaryRuleForm`'s `ROLE_LABELS`, `features` не может кросс-импортировать
 * другую `features` ради одной константы, а формулировки здесь чуть отличаются — "Менеджер заказа"
 * в единственном числе, как показывает Pencil `b6mfxv`'s "Role" ячейки, а не "Менеджер заказов").
 * Общий на оба направления enum (см. `contracts/commands/salary-rule.ts`), поэтому карта покрывает
 * весь `TargetRole`, а не только роли, реально видимые в отчёте отдела/сотрудника.
 */
export const ROLE_LABELS: Record<TargetRole, string> = {
    ENGINEER: 'Инженер',
    ONLINE_MANAGER: 'Онлайн-менеджер',
    OFFLINE_MANAGER: 'Офлайн-менеджер',
    ORDER_MANAGER: 'Менеджер заказа',
    ONLINE_PURCHASER: 'Онлайн-закупщик',
    OFFLINE_PURCHASER: 'Офлайн-закупщик',
    OFFICE: 'Офис',
    SOLO_MANAGER: 'Соло-менеджер',
}

/** `role` — строго `TargetRole` по контракту, поэтому не нуждается в fallback-ветке (в отличие от
 * `getRuleTypeLabel`, где `type` приходит как ослабленная `z.string()`). */
export function getRoleLabel(role: TargetRole): string {
    return ROLE_LABELS[role]
}

/**
 * Названия типов правил (`rule.type`) — реэкспорт объединённой карты `kernel/ruleTypeLabels.ts`
 * (уже покрывает оба направления, `PayPerHour`/`ServiceCompleted`/`OrderPayed`/
 * `ProductSold`/`UsedProductSold`) под именем, которое ожидают потребители этого модуля. Не копия
 * — тот же объект, чтобы не рассинхронизироваться с `kernel`, если список типов вырастет.
 */
export const RULE_TYPE_LABELS: Record<string, string> = ALL_RULE_TYPE_LABELS

/** `rule.type` в отчёте — ослабленная `z.string()` (см. `employeeSalaryReportRuleSchema`), а не
 * дискриминированный union, поэтому в отличие от `getRoleLabel` здесь нужен fallback на сырое
 * значение — на случай, если бэкенд начнёт отдавать тип правила, ещё не заведённый в карте. */
export function getRuleTypeLabel(type: string): string {
    return RULE_TYPE_LABELS[type] ?? type
}
