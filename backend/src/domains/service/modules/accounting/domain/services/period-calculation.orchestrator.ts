import { CalculationContext } from '@/shared/domain/calculation-context';
import { CalculationLine } from '@/shared/domain/calculation-line';
import { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';

// Оркестратор расчёта зарплаты за период. Контекст собирается один раз
// вызывающей стороной (application-слой — она же знает, как достать
// сотрудника, ERP-данные и SalesPerformance) и передаётся сюда неизменным
// во все правила схемы; сам оркестратор к репозиториям не обращается.
//
// Никаких switch по ролям или типам правил: правило само знает, как считать
// свой KPI, оркестратор лишь вызывает calculate() и суммирует строки. Это
// даёт отсутствие N+1 при расчёте отдела (контекст один на всех сотрудников
// эквивалентного прохода) и одинаковую выборку данных для всех правил
// одного сотрудника — см. docs/payroll/prd-payroll-calculation.md, Фаза 1.
//
// spec: service/accounting#requirement-мотивационная-схема-как-набор-зарплатных-правил
export class PeriodCalculationOrchestrator {
    // (CalculationLine | null)[] — null на позиции правила, чьё calculate()
    // ещё не готово выдать строку (см. SalaryRule.calculate()); позиция в
    // массиве сохраняется 1:1 с rules[], а не схлопывается, чтобы
    // buildRuleBreakdown/buildSalaryReportRules могли сопоставить строку с
    // породившим её правилом.
    static async calculate(
        rules: SalaryRule[],
        context: CalculationContext,
    ): Promise<(CalculationLine | null)[]> {
        const lines: (CalculationLine | null)[] = [];
        for (const rule of rules) {
            lines.push(await rule.calculate(context));
        }
        return lines;
    }

    static total(lines: (CalculationLine | null)[]): number {
        return lines.reduce((sum, line) => sum + (line?.amount ?? 0), 0);
    }
}
