import type { SalaryAccrualLineStatus, SalaryAccrualStatus, TargetRole } from 'ireports-contracts'

/**
 * Подписи статусов документа начисления (Pencil `cfNlL`: бейджи колонки «Статус»).
 * Дублирует четыре строки `ACCRUAL_STATUS_LABEL` из features/AccountingPeriod/model/labels.ts
 * (перечень диалога переоткрытия) — кросс-импорт между features запрещён линтингом
 * (frontend/CLAUDE.md), а тащить одну константу в kernel ради четырёх строк — тот же
 * компромисс, что уже принят для `ROLE_LABELS` (features/SalaryRuleForm vs
 * pages/SalaryReport/model/labels.ts): у каждой стороны своя копия.
 */
export const ACCRUAL_STATUS_LABEL: Record<SalaryAccrualStatus, string> = {
    DRAFT: 'Черновик',
    PARTIALLY_ACCRUED: 'Частично начислено',
    ACCRUED: 'Ожидает выплаты',
    PAID: 'Выплачено',
}

/** Подписи статусов СТРОКИ документа (Pencil `jb7fL`, колонка «Статус строки»): в отличие от
 * документа, строка в `ACCRUED` — уже «Начислено» (проведена на баланс), а не «ожидает». */
export const ACCRUAL_LINE_STATUS_LABEL: Record<SalaryAccrualLineStatus, string> = {
    DRAFT: 'Черновик',
    ACCRUED: 'Начислено',
    PAID: 'Выплачено',
}

/** Человекочитаемые роли — та же карта, что pages/SalaryReport/model/labels.ts (см. её
 * комментарий про допустимость копий этой карты между слоями). */
export const ROLE_LABEL: Record<TargetRole, string> = {
    ENGINEER: 'Инженер',
    ONLINE_MANAGER: 'Онлайн-менеджер',
    OFFLINE_MANAGER: 'Офлайн-менеджер',
    ORDER_MANAGER: 'Менеджер заказа',
    ONLINE_PURCHASER: 'Онлайн-закупщик',
    OFFLINE_PURCHASER: 'Офлайн-закупщик',
    OFFICE: 'Офис',
    SOLO_MANAGER: 'Соло-менеджер',
}

/** База начисления процентных правил (`salaryBasis`, contracts/commands/salary-rule.ts) —
 * ослабленная `z.string()` в calculationLineSchema, поэтому с fallback на сырое значение. */
const SALARY_BASIS_LABEL: Record<string, string> = {
    REVENUE: 'Выручка',
    MARGIN: 'Маржа',
    SALARY_MINUS_ENGINEER_SALARY: 'Выручка − ЗП инженера',
}

export function getSalaryBasisLabel(basis: string | undefined): string {
    if (basis === undefined) return '—'
    return SALARY_BASIS_LABEL[basis] ?? basis
}

/** Типы источников строки — реальные значения `sources[].type` с бэкенда (та же карта и
 * обоснование, что у pages/SalaryReport/ui/RuleSources.tsx). */
const SOURCE_TYPE_LABEL: Record<string, string> = {
    order: 'Заказ',
    serviceOrderItem: 'Позиция услуги',
    taskCompletion: 'Задача',
    demandPosition: 'Позиция отгрузки',
}

export function getSourceTypeLabel(type: string): string {
    return SOURCE_TYPE_LABEL[type] ?? type
}
