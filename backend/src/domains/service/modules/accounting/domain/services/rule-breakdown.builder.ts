import {
    CalculationLine,
    CalculationSourceRef,
} from '@/shared/domain/calculation-line';
import {
    SalaryRule,
    TargetRole,
} from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

// Строка разбивки зарплаты по правилу — CalculationLine (см.
// shared/domain/calculation-line.ts), обогащённая атрибутами самого правила
// (type/name/targetRole), которые калькулятор не знает и не обязан знать.
// Используется в двух местах: сборка ответа отчёта (открытый период,
// GetEmployeeSalaryReportService) и сборка снапшота при закрытии периода
// (CloseAccountingPeriodHandler) — чтобы не дублировать эту склейку.
export interface RuleBreakdownLine {
    ruleId: string;
    type: string;
    name: string;
    targetRole: TargetRole;
    salaryBasis?: string;
    quantity?: number;
    rate?: number;
    amount: number;
    sources: CalculationSourceRef[];
    // Раздел 10 tasks.md (add-task-based-salary-rule) — прокидывает
    // CalculationLine.requiresManualInput (см. shared/domain/calculation-line.ts)
    // дальше по цепочке в документ начисления (SalaryAccrualSourceLine,
    // раздел 13).
    requiresManualInput?: boolean;
}

// rules и lines собраны одним и тем же оркестратором за один проход (см.
// PeriodCalculationOrchestrator.calculate) — строки идут в том же порядке,
// что и правила схемы, поэтому сопоставление по индексу безопасно. Правило,
// чья строка на этой позиции — null (см. SalaryRule.calculate()), пропускается
// целиком: пустая строка на его место не вставляется — spec:
// service/accounting#requirement-правило-за-выполнение-задачи-не-видно-в-прогнозе-до-выполнения.
export function buildRuleBreakdown(
    rules: SalaryRule[],
    lines: (CalculationLine | null)[],
): RuleBreakdownLine[] {
    return rules.flatMap((rule, index) => {
        const line = lines[index];
        if (!line) {
            return [];
        }
        return [
            {
                ruleId: rule.id,
                type: rule.type,
                name: rule.name,
                targetRole: rule.targetRole,
                salaryBasis: line.salaryBasis,
                quantity: line.quantity,
                rate: line.rate,
                amount: line.amount,
                sources: line.sources,
                requiresManualInput: line.requiresManualInput,
            },
        ];
    });
}
