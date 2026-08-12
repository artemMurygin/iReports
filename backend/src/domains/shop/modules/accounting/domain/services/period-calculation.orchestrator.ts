import { CalculationLine } from '@/shared/domain/calculation-line';
import { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/shop-salary-rule.types';
import type { ShopCalculationContext } from '@/domains/shop/modules/accounting/domain/types/shop-calculation-context.types';

// Зеркало domains/service/modules/accounting/domain/services/period-calculation.orchestrator.ts
// (Фаза 13.5, issue #57) — независимая реализация в домене shop. Контекст
// собирается один раз вызывающей стороной (application-слой) и передаётся
// сюда неизменным во все правила схемы; сам оркестратор к репозиториям не
// обращается.
//
// Никаких switch по ролям или типам правил: правило само знает, как считать
// свой KPI, оркестратор лишь вызывает calculate() и суммирует строки.
//
// Правила в этой итерации независимы и не ссылаются на результаты друг
// друга — итог является простой суммой строк.
export class PeriodCalculationOrchestrator {
    static async calculate(
        rules: ShopSalaryRule[],
        context: ShopCalculationContext,
    ): Promise<CalculationLine[]> {
        const lines: CalculationLine[] = [];
        for (const rule of rules) {
            lines.push(await rule.calculate(context));
        }
        return lines;
    }

    static total(lines: CalculationLine[]): number {
        return lines.reduce((sum, line) => sum + line.amount, 0);
    }
}
