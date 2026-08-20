import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { PeriodCalculationOrchestrator } from '@/domains/service/modules/accounting/domain/services/period-calculation.orchestrator';
import { BuildServiceCalculationContextService } from '@/domains/service/modules/accounting/application/services/build-service-calculation-context.service';
import { ResolveEmployeeSalaryRulesService } from '@/domains/service/modules/accounting/application/services/resolve-employee-salary-rules.service';
import { toSalesPerformanceContext } from '@/domains/service/modules/accounting/application/mappers/to-sales-performance-context';
import { buildRuleBreakdown } from '@/domains/service/modules/accounting/domain/services/rule-breakdown.builder';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { UnapprovedSalesPlanRowsException } from '@/domains/service/modules/accounting/domain/exceptions/accounting-period.exception';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import { ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type {
    AccountingPeriodSnapshotPort,
    AccountingPeriodSnapshotRow,
} from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import { ACCOUNTING_CALCULATION_CACHE } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { toAccountingPeriodResponse } from '../mappers/to-accounting-period-response';
import { CloseAccountingPeriodCommand } from './close-accounting-period.command';

// Закрытие расчётного периода (Фаза 6, см.
// docs/payroll/plan-payroll-calculation.md, "Фаза 6: Расчётный период,
// ленивый кэш и снапшоты"):
// 1) отклоняется, если есть хоть одна неутверждённая строка плана продаж
//    периода/направления;
// 2) иначе снимает FACT-срез по каждому сотруднику, у которого есть
//    зарплатные правила — в личной схеме ИЛИ в схеме его отдела (тем же
//    оркестратором, что и открытый расчёт), — и фиксирует его неизменяемым
//    снапшотом;
// 3) переводит период в CLOSED и порождает AccountingPeriodClosedDomainEvent.
@CommandHandler(CloseAccountingPeriodCommand)
export class CloseAccountingPeriodHandler implements ICommandHandler<
    CloseAccountingPeriodCommand,
    AccountingPeriodResponse
> {
    constructor(
        @Inject(ACCOUNTING_PERIOD_REPOSITORY)
        private readonly periodRepo: AccountingPeriodRepositoryPort,
        @Inject(ACCOUNTING_PERIOD_SNAPSHOT)
        private readonly snapshotRepo: AccountingPeriodSnapshotPort,
        @Inject(ACCOUNTING_CALCULATION_CACHE)
        private readonly cacheRepo: AccountingCalculationCachePort,
        @Inject(SALES_PLAN_REPOSITORY)
        private readonly salesPlanRepo: SalesPlanRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
        private readonly contextBuilder: BuildServiceCalculationContextService,
        private readonly salaryRulesResolver: ResolveEmployeeSalaryRulesService,
    ) {}

    async execute(
        command: CloseAccountingPeriodCommand,
    ): Promise<AccountingPeriodResponse> {
        const period = Period.create(command.period);

        const plans = await this.salesPlanRepo.findByDirectionAndPeriod(
            'service',
            period.getValue(),
        );
        const unapproved = plans.filter((plan) => plan.status !== 'APPROVED');
        if (unapproved.length > 0) {
            throw new UnapprovedSalesPlanRowsException(
                'service',
                period.getValue(),
                unapproved.map((plan) => ({
                    id: plan.id,
                    department: plan.department,
                    category: plan.category,
                })),
            );
        }

        const existing = await this.periodRepo.findByDirectionAndPeriod(
            'service',
            period.getValue(),
        );
        const periodEntity =
            existing ??
            AccountingPeriod.openFor({
                direction: 'service',
                period: period.getValue(),
            });

        // Снапшот — все сотрудники, у которых есть зарплатные правила: с
        // личной схемой и/или со схемой на их отдел (см.
        // ResolveEmployeeSalaryRulesService.forAllTargets).
        const rows = await this.closeServiceDirection(period);

        periodEntity.close(command.closedBy, rows.length);

        await this.unitOfWork.run(async () => {
            await this.periodRepo.save(periodEntity);
            await this.snapshotRepo.saveAll(
                periodEntity.id,
                'service',
                period.getValue(),
                rows,
            );
            await this.cacheRepo.deleteByDirectionAndPeriod(
                'service',
                period.getValue(),
            );
        });

        return toAccountingPeriodResponse(
            periodEntity,
            'service',
            period.getValue(),
        );
    }

    private async closeServiceDirection(
        period: Period,
    ): Promise<AccountingPeriodSnapshotRow[]> {
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
