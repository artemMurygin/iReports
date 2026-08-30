import { Injectable } from '@nestjs/common';
import { Period } from '@/shared/domain/period.value-object';
import type { ShopAccountingPeriodSnapshotRow } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type { ShopSnapshotRowsCalculatorPort } from '@/domains/shop/modules/accounting/application/ports/calculation/snapshot-rows-calculator.port';
import { PeriodCalculationOrchestrator } from '@/domains/shop/modules/accounting/domain/services/period-calculation.orchestrator';
import { buildRuleBreakdown } from '@/domains/shop/modules/accounting/domain/services/rule-breakdown.builder';
import { toShopSalesPerformanceContext } from '@/domains/shop/modules/accounting/application/mappers/salary-report/to-sales-performance-context';
import { BuildShopCalculationContextService } from './build-calculation-context.service';
import { ResolveShopEmployeeSalaryRulesService } from './resolve-employee-salary-rules.service';

// FACT-срез направления shop по каждому сотруднику с зарплатными правилами
// (личная схема и/или схема отдела). Вынесен из
// CloseShopAccountingPeriodHandler (Фаза 2 PRD 1
// docs/payroll-closing-and-accrual), чтобы close-preview считался тем же
// кодом, что и закрытие. Порт ShopSnapshotRowsCalculatorPort — собственный,
// независимый от одноимённого порта domains/service (Фаза 5
// docs/service-shop-boundary-violations-fix).
@Injectable()
export class CalculateShopSnapshotRowsService implements ShopSnapshotRowsCalculatorPort {
    constructor(
        private readonly shopContextBuilder: BuildShopCalculationContextService,
        private readonly salaryRulesResolver: ResolveShopEmployeeSalaryRulesService,
    ) {}

    async calculate(
        period: Period,
    ): Promise<ShopAccountingPeriodSnapshotRow[]> {
        const salaryRulesByEmployee =
            await this.salaryRulesResolver.forAllTargets();
        const rows: ShopAccountingPeriodSnapshotRow[] = [];
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
