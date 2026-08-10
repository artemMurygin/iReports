// Результат calculate() одного зарплатного правила за один проход (один
// CalculationMode) — не число, а строка расчёта. Сценарий «сотрудник видит
// разбивку по каждому правилу с указанием, на каких заказах она получена»
// невыполним при возврате скаляра (см. PRD, раздел «Контекст расчёта»).
// Форма едина для service и shop; зеркало для HTTP-ответа —
// contracts/commands/salary-rule.ts → calculationLineSchema.

export interface CalculationSourceRef {
    // Конкретные типы источников определяет само правило своего домена
    // ('order' | 'orderItem' | 'demand' | 'demandPosition' | ...).
    type: string;
    id: string | number;
}

export interface CalculationLine {
    ruleId: string;
    // База начисления (REVENUE / MARGIN / ...) — не у всех правил есть
    // (например, у PayPerHour), поэтому опционально.
    salaryBasis?: string;
    quantity?: number;
    rate?: number;
    amount: number;
    sources: CalculationSourceRef[];
}
