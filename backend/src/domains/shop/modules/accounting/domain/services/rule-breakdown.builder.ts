import {
    CalculationLine,
    CalculationSourceRef,
} from '@/shared/domain/calculation-line';
import {
    ShopSalaryRule,
    TargetRole,
} from '@/domains/shop/modules/accounting/domain/types/salary-rule.types';

// Зеркало domains/service/modules/accounting/domain/services/rule-breakdown.builder.ts
// (Фаза 13.5, issue #57) — независимая реализация в домене shop. Строка
// разбивки зарплаты по правилу — CalculationLine (см.
// shared/domain/calculation-line.ts), обогащённая атрибутами самого правила
// (type/name/targetRole), которые калькулятор не знает и не обязан знать.
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
    rules: ShopSalaryRule[],
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
