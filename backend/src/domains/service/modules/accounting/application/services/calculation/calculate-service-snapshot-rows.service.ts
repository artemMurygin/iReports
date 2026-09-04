import { Injectable } from '@nestjs/common';
import { Period } from '@/shared/domain/period.value-object';
import { PeriodCalculationOrchestrator } from '@/domains/service/modules/accounting/domain/services/period-calculation.orchestrator';
import { buildRuleBreakdown } from '@/domains/service/modules/accounting/domain/services/rule-breakdown.builder';
import { toSalesPerformanceContext } from '@/domains/service/modules/accounting/application/mappers/salary-report/to-sales-performance-context';
import type { AccountingPeriodSnapshotRow } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type { SnapshotRowsCalculatorPort } from '@/domains/service/modules/accounting/application/ports/calculation/snapshot-rows-calculator.port';
import { BuildServiceCalculationContextService } from './build-service-calculation-context.service';
import { ResolveEmployeeSalaryRulesService } from './resolve-employee-salary-rules.service';

// FACT-срез направления service по каждому сотруднику с зарплатными
// правилами — в личной схеме ИЛИ в схеме его отдела (тем же оркестратором,
// что и открытый расчёт). Вынесен из CloseAccountingPeriodHandler (Фаза 2
// PRD 1), чтобы сводка close-preview считалась тем же кодом, что и закрытие.
@Injectable()
export class CalculateServiceSnapshotRowsService implements SnapshotRowsCalculatorPort {
    constructor(
        private readonly contextBuilder: BuildServiceCalculationContextService,
        private readonly salaryRulesResolver: ResolveEmployeeSalaryRulesService,
    ) {}

    async calculate(period: Period): Promise<AccountingPeriodSnapshotRow[]> {
        const salaryRulesByEmployee =
            await this.salaryRulesResolver.forAllTargets();
        const rows: AccountingPeriodSnapshotRow[] = [];
        for (const [employeeId, { rules }] of salaryRulesByEmployee) {
            // Сотрудник отдела со схемой, у которого после фильтра по
            // direction='service' не осталось ни одного правила (вся схема
            // отдела — правила магазина), в снапшот не попадает: пустая
            // строка на нулевую сумму завысила бы closedRows и ничего не
            // фиксировала бы.
            if (rules.length === 0) {
                continue;
            }
            const base = await this.contextBuilder.build(period, employeeId);
            const lines = await PeriodCalculationOrchestrator.calculate(rules, {
                employee: base.employee,
                period: base.period,
                erpData: base.erpData,
                mode: 'FACT',
                salesPerformance: toSalesPerformanceContext(
                    base.salesPerformanceDetail,
                    'FACT',
                ),
            });
            rows.push({
                employeeId,
                total: PeriodCalculationOrchestrator.total(lines),
                lines: buildRuleBreakdown(rules, lines),
            });
        }
        return rows;
    }
}
