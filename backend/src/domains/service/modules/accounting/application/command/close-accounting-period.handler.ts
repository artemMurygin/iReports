import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { PeriodCalculationOrchestrator } from '@/domains/service/modules/accounting/domain/services/period-calculation.orchestrator';
import { BuildServiceCalculationContextService } from '@/domains/service/modules/accounting/application/services/build-service-calculation-context.service';
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
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import { BuildShopCalculationContextService } from '@/domains/shop/modules/accounting/application/services/build-shop-calculation-context.service';
import { PeriodCalculationOrchestrator as ShopPeriodCalculationOrchestrator } from '@/domains/shop/modules/accounting/domain/services/period-calculation.orchestrator';
import { buildRuleBreakdown as shopBuildRuleBreakdown } from '@/domains/shop/modules/accounting/domain/services/rule-breakdown.builder';
import { toShopSalesPerformanceContext } from '@/domains/shop/modules/accounting/application/mappers/to-shop-sales-performance-context';
import { toAccountingPeriodResponse } from '../mappers/to-accounting-period-response';
import { CloseAccountingPeriodCommand } from './close-accounting-period.command';

// Закрытие расчётного периода (Фаза 6, см.
// docs/payroll/plan-payroll-calculation.md, "Фаза 6: Расчётный период,
// ленивый кэш и снапшоты"):
// 1) отклоняется, если есть хоть одна неутверждённая строка плана продаж
//    периода/направления;
// 2) иначе снимает FACT-срез по каждому сотруднику с личной мотивационной
//    схемой (тем же оркестратором, что и открытый расчёт) и фиксирует его
//    неизменяемым снапшотом;
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
        @Inject(MOTIVATION_SCHEMA_REPOSITORY)
        private readonly motivationSchemaRepo: MotivationSchemaRepositoryPort,
        @Inject(SALES_PLAN_REPOSITORY)
        private readonly salesPlanRepo: SalesPlanRepositoryPort,
        @Inject(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
        private readonly shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
        private readonly contextBuilder: BuildServiceCalculationContextService,
        private readonly shopContextBuilder: BuildShopCalculationContextService,
    ) {}

    async execute(
        command: CloseAccountingPeriodCommand,
    ): Promise<AccountingPeriodResponse> {
        const period = Period.create(command.period);

        const plans = await this.salesPlanRepo.findByDirectionAndPeriod(
            command.direction,
            period.getValue(),
        );
        const unapproved = plans.filter((plan) => plan.status !== 'APPROVED');
        if (unapproved.length > 0) {
            throw new UnapprovedSalesPlanRowsException(
                command.direction,
                period.getValue(),
                unapproved.map((plan) => ({
                    id: plan.id,
                    department: plan.department,
                    category: plan.category,
                })),
            );
        }

        const existing = await this.periodRepo.findByDirectionAndPeriod(
            command.direction,
            period.getValue(),
        );
        const periodEntity =
            existing ??
            AccountingPeriod.openFor({
                direction: command.direction,
                period: period.getValue(),
            });

        // Снапшот — только сотрудники с личной мотивационной схемой (см.
        // MotivationSchemaRepositoryPort.findAllEmployeeTargets); схемы на
        // отдел здесь, как и в Фазе 1, не разворачиваются. Выбор
        // motivationSchemaRepo/context-builder по направлению (Фаза 13.5,
        // issue #57) — до этой правки хендлер был жёстко захардкожен на
        // сервисные зависимости и при command.direction === 'shop' молча
        // считал снапшот по сервисным мотивационным схемам сотрудника,
        // что было латентным багом; closeServiceDirection/closeShopDirection
        // делают выбор явным.
        const rows =
            command.direction === 'service'
                ? await this.closeServiceDirection(period)
                : await this.closeShopDirection(period);

        periodEntity.close(command.closedBy, rows.length);

        await this.unitOfWork.run(async () => {
            await this.periodRepo.save(periodEntity);
            await this.snapshotRepo.saveAll(
                periodEntity.id,
                command.direction,
                period.getValue(),
                rows,
            );
            await this.cacheRepo.deleteByDirectionAndPeriod(
                command.direction,
                period.getValue(),
            );
        });

        return toAccountingPeriodResponse(
            periodEntity,
            command.direction,
            period.getValue(),
        );
    }

    private async closeServiceDirection(
        period: Period,
    ): Promise<AccountingPeriodSnapshotRow[]> {
        const schemas =
            await this.motivationSchemaRepo.findAllEmployeeTargets();
        const rows: AccountingPeriodSnapshotRow[] = [];
        for (const schema of schemas) {
            const props = schema.getProps();
            const employeeId = props.target.getId();
            const rules = props.rules;
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

    private async closeShopDirection(
        period: Period,
    ): Promise<AccountingPeriodSnapshotRow[]> {
        const schemas =
            await this.shopMotivationSchemaRepo.findAllEmployeeTargets();
        const rows: AccountingPeriodSnapshotRow[] = [];
        for (const schema of schemas) {
            const props = schema.getProps();
            const employeeId = props.target.getId();
            const rules = props.rules;
            const base = await this.shopContextBuilder.build(
                period,
                employeeId,
                rules,
            );
            const lines = await ShopPeriodCalculationOrchestrator.calculate(
                rules,
                {
                    employee: base.employee,
                    period: base.period,
                    erpData: base.erpData,
                    mode: 'FACT',
                    salesPerformance: toShopSalesPerformanceContext(
                        base.salesPerformanceDetail,
                        'FACT',
                    ),
                },
            );
            rows.push({
                employeeId,
                total: ShopPeriodCalculationOrchestrator.total(lines),
                lines: shopBuildRuleBreakdown(rules, lines),
            });
        }
        return rows;
    }
}
