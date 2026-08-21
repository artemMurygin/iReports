import { Injectable } from '@nestjs/common';
import { Period } from '@/shared/domain/period.value-object';
import type { AccountingPeriodSnapshotRow } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { SnapshotRowsCalculatorPort } from '@/domains/service/modules/accounting/application/ports/snapshot-rows-calculator.port';
import { PeriodCalculationOrchestrator } from '@/domains/shop/modules/accounting/domain/services/period-calculation.orchestrator';
import { buildRuleBreakdown } from '@/domains/shop/modules/accounting/domain/services/rule-breakdown.builder';
import { toShopSalesPerformanceContext } from '@/domains/shop/modules/accounting/application/mappers/to-shop-sales-performance-context';
import { BuildShopCalculationContextService } from './build-shop-calculation-context.service';
import { ResolveShopEmployeeSalaryRulesService } from './resolve-shop-employee-salary-rules.service';

// FACT-срез направления shop по каждому сотруднику с зарплатными правилами
// (личная схема и/или схема отдела). Вынесен из
// CloseShopAccountingPeriodHandler (Фаза 2 PRD 1
// docs/payroll-closing-and-accrual), чтобы close-preview считался тем же
// кодом, что и закрытие. Порт SnapshotRowsCalculatorPort физически лежит в
// domains/service/modules/accounting, но direction-агностичен (как
// AccountingPeriod/снапшот — см. шапку CloseShopAccountingPeriodHandler).
@Injectable()
export class CalculateShopSnapshotRowsService implements SnapshotRowsCalculatorPort {
    constructor(
        private readonly shopContextBuilder: BuildShopCalculationContextService,
        private readonly salaryRulesResolver: ResolveShopEmployeeSalaryRulesService,
    ) {}

    async calculate(period: Period): Promise<AccountingPeriodSnapshotRow[]> {
        const salaryRulesByEmployee =
            await this.salaryRulesResolver.forAllTargets();
        const rows: AccountingPeriodSnapshotRow[] = [];
        for (const [employeeId, { rules }] of salaryRulesByEmployee) {
            // Сотрудник отдела со схемой, у которого после фильтра по
            // direction='shop' не осталось ни одного правила (вся схема
            // отдела — правила сервиса), в снапшот не попадает.
            if (rules.length === 0) {
                continue;
            }
            const base = await this.shopContextBuilder.build(
                period,
                employeeId,
                rules,
            );
            const lines = await PeriodCalculationOrchestrator.calculate(rules, {
                employee: base.employee,
                period: base.period,
                erpData: base.erpData,
                mode: 'FACT',
                salesPerformance: toShopSalesPerformanceContext(
                    base.salesPerformanceByCategory,
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
