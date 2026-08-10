import { Inject, Injectable } from '@nestjs/common';
import type { EmployeeSalaryReportResponse } from 'ireports-contracts';
import { ArgumentInvalidException } from '@/shared/exceptions';
import { CalculationContext } from '@/shared/domain/calculation-context';
import { PeriodCalculationOrchestrator } from '@/domains/service/modules/accounting/domain/services/period-calculation.orchestrator';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// Тонкий сквозной путь Фазы 1: находит мотивационную схему сотрудника,
// один раз собирает контекст расчёта (отдельно для FACT и для PROGNOSE —
// отдельной ветки под прогноз нет, см. PRD раздел 6) и отдаёт оркестратору.
// Сотрудник без схемы получает отчёт с нулевым итогом, а не ошибку — это не
// исключительная ситуация.
//
// Пока не реализовано (следующие фазы плана):
// - EmployeeIdentity/ERP-данные в контексте (Фаза 2 и далее — сейчас
//   erpData/erpData не подкладываются, доступные правила Фазы 1 их не
//   используют);
// - SalesPerformance и isPlanApproved (Фаза 5) — salesPerformance = null,
//   isPlanApproved = true, потому что без плана нечего утверждать;
// - AccountingPeriod/снапшоты закрытых месяцев (Фаза 6) — период всегда
//   считается открытым (isClosed = false);
// - направление shop (Фазы 10-13) — directions содержит только 'service'.
@Injectable()
export class GetEmployeeSalaryReportService {
    constructor(
        @Inject(MOTIVATION_SCHEMA_REPOSITORY)
        private readonly motivationSchemaRepo: MotivationSchemaRepositoryPort,
    ) {}

    async execute(
        employeeId: number,
        period: string,
    ): Promise<EmployeeSalaryReportResponse> {
        if (!PERIOD_PATTERN.test(period)) {
            throw new ArgumentInvalidException(
                `Период должен быть в формате YYYY-MM, получено: "${period}"`,
            );
        }

        const schema =
            await this.motivationSchemaRepo.findByEmployee(employeeId);
        const rules = schema?.getProps().rules ?? [];

        const { from, to } = buildMonthBounds(period);
        const baseContext: Omit<CalculationContext, 'mode'> = {
            employee: { id: employeeId, identities: [] },
            period: { direction: 'service', period, from, to, status: 'OPEN' },
            erpData: undefined,
            salesPerformance: null,
        };

        const [factLines, prognoseLines] = await Promise.all([
            PeriodCalculationOrchestrator.calculate(rules, {
                ...baseContext,
                mode: 'FACT',
            }),
            PeriodCalculationOrchestrator.calculate(rules, {
                ...baseContext,
                mode: 'PROGNOSE',
            }),
        ]);

        const ruleBreakdown = rules.map((rule, index) => ({
            ruleId: rule.id,
            type: rule.type,
            name: rule.name,
            targetRole: rule.targetRole,
            amount: {
                fact: factLines[index].amount,
                prognose: prognoseLines[index].amount,
            },
            sources: factLines[index].sources,
        }));

        const factTotal = PeriodCalculationOrchestrator.total(factLines);
        const prognoseTotal =
            PeriodCalculationOrchestrator.total(prognoseLines);

        return {
            period,
            isClosed: false,
            directions: [
                {
                    direction: 'service',
                    total: { fact: factTotal, prognose: prognoseTotal },
                    rules: ruleBreakdown,
                    salesPerformance: null,
                    isPlanApproved: true,
                },
            ],
            grandTotal: { fact: factTotal, prognose: prognoseTotal },
        };
    }
}

function buildMonthBounds(period: string): { from: Date; to: Date } {
    const [year, month] = period.split('-').map(Number);
    const from = new Date(Date.UTC(year, month - 1, 1));
    // День 0 следующего месяца — последний день текущего.
    const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { from, to };
}
