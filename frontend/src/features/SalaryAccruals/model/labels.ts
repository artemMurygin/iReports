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
    demandPosition: 'Позиция отгрузки',
}

export function getSourceTypeLabel(type: string): string {
    return SOURCE_TYPE_LABEL[type] ?? type
}

/**
 * Счётные формы существительного-единицы для «Основание» строки правила (Pencil `DQ3tV`/`g0onp`:
 * «42 заказа × 8%», «18 продаж × 5%», «3 задачи × 1 000 ₽») — [1, 2–4, 5+] по числу `line.quantity`,
 * ключ — `line.type` (те же значения `ServiceRuleType`/`ShopRuleType`, что и `ALL_RULE_TYPE_LABELS`
 * в `kernel/ruleTypeLabels.ts`; не импортируется отсюда напрямую — `ослабленная` строка `type` в
 * `salaryAccrualLineSchema`, тот же приём, что и `SALARY_BASIS_LABEL`/`SOURCE_TYPE_LABEL` выше).
 * `PayPerHour` не участвует — часы форматируются отдельно (`accrualView.ts`'s
 * `formatLineBasisNote`), у них не бывает «1 час/2 часа/5 часов» в макете, только голое «130 ч».
 */
export const RULE_UNIT_FORMS: Record<string, [one: string, few: string, many: string]> = {
    OrderPayed: ['заказ', 'заказа', 'заказов'],
    ServiceCompleted: ['услуга', 'услуги', 'услуг'],
    ProductSold: ['продажа', 'продажи', 'продаж'],
    UsedProductSold: ['продажа', 'продажи', 'продаж'],
}

/** Именительный падеж множественного числа той же единицы — вторая часть меты строки правила
 * (Pencil «Процент от суммы работ · заказы» — тип берётся из `ALL_RULE_TYPE_LABELS`, источник
 * отсюда), отдельно от счётных форм выше: для «заказ» они расходятся («2 заказа» ≠ «заказы»),
 * совпадают только у форм женского рода. Бренд ERP («RemOnline»/«МойСклад») из макета сюда
 * намеренно не попадает — `sources[].type` его не несёт (см. `AccrualLineSources.tsx`'s
 * комментарий), показывать вместо него настоящий бренд значило бы придумывать данные. */
export const RULE_UNIT_PLURAL_LABEL: Record<string, string> = {
    OrderPayed: 'заказы',
    ServiceCompleted: 'услуги',
    ProductSold: 'продажи',
    UsedProductSold: 'продажи',
}
