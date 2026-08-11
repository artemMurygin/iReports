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
}

// rules и lines собраны одним и тем же оркестратором за один проход (см.
// PeriodCalculationOrchestrator.calculate) — строки идут в том же порядке,
// что и правила схемы, поэтому сопоставление по индексу безопасно.
export function buildRuleBreakdown(
    rules: SalaryRule[],
    lines: CalculationLine[],
): RuleBreakdownLine[] {
    return rules.map((rule, index) => {
        const line = lines[index];
        return {
            ruleId: rule.id,
            type: rule.type,
            name: rule.name,
            targetRole: rule.targetRole,
            salaryBasis: line.salaryBasis,
            quantity: line.quantity,
            rate: line.rate,
            amount: line.amount,
            sources: line.sources,
        };
    });
}
