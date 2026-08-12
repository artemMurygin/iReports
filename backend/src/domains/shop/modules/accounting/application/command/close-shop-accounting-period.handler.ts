import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
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
import { toAccountingPeriodResponse } from '@/domains/service/modules/accounting/application/mappers/to-accounting-period-response';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import { BuildShopCalculationContextService } from '@/domains/shop/modules/accounting/application/services/build-shop-calculation-context.service';
import { PeriodCalculationOrchestrator } from '@/domains/shop/modules/accounting/domain/services/period-calculation.orchestrator';
import { buildRuleBreakdown } from '@/domains/shop/modules/accounting/domain/services/rule-breakdown.builder';
import { toShopSalesPerformanceContext } from '@/domains/shop/modules/accounting/application/mappers/to-shop-sales-performance-context';
import { CloseShopAccountingPeriodCommand } from './close-shop-accounting-period.command';

// Закрытие расчётного периода направления shop (Фаза 13.5, issue #57) —
// независимый CQRS-вход, выделенный из CloseAccountingPeriodHandler
// (domains/service/modules/accounting), который до этой правки обслуживал
// оба направления через direction в команде и приватный closeShopDirection().
// direction здесь не поле команды/аргумент — он зафиксирован самим
// расположением класса в домене shop (см. также
// CloseAccountingPeriodHandler — зеркальный независимый вход для service).
//
// Зависимости порта периода/снапшота/кэша/плана продаж и сама сущность
// AccountingPeriod физически лежат в domains/service/modules/accounting, но
// это общие направление-агностичные абстракции (direction — часть их
// естественного ключа, см. AccountingPeriod, шапка комментария), а не
// service-специфичная бизнес-логика — поэтому их переиспользование здесь не
// нарушает запрет на импорт между доменами service/shop (см.
// backend/CLAUDE.md).
//
// Логика:
// 1) отклоняется, если есть хоть одна неутверждённая строка плана продаж
//    периода направления shop;
// 2) иначе снимает FACT-срез по каждому сотруднику с личной shop-
//    мотивационной схемой (тем же оркестратором, что и открытый расчёт) и
//    фиксирует его неизменяемым снапшотом;
// 3) переводит период в CLOSED и порождает AccountingPeriodClosedDomainEvent.
@CommandHandler(CloseShopAccountingPeriodCommand)
export class CloseShopAccountingPeriodHandler implements ICommandHandler<
    CloseShopAccountingPeriodCommand,
    AccountingPeriodResponse
> {
    constructor(
        @Inject(ACCOUNTING_PERIOD_REPOSITORY)
        private readonly periodRepo: AccountingPeriodRepositoryPort,
        @Inject(ACCOUNTING_PERIOD_SNAPSHOT)
        private readonly snapshotRepo: AccountingPeriodSnapshotPort,
        @Inject(ACCOUNTING_CALCULATION_CACHE)
        private readonly cacheRepo: AccountingCalculationCachePort,
        @Inject(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
        private readonly shopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort,
        @Inject(SALES_PLAN_REPOSITORY)
        private readonly salesPlanRepo: SalesPlanRepositoryPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
        private readonly shopContextBuilder: BuildShopCalculationContextService,
    ) {}

    async execute(
        command: CloseShopAccountingPeriodCommand,
    ): Promise<AccountingPeriodResponse> {
        const direction = 'shop' as const;
        const period = Period.create(command.period);

        const plans = await this.salesPlanRepo.findByDirectionAndPeriod(
            direction,
            period.getValue(),
        );
        const unapproved = plans.filter((plan) => plan.status !== 'APPROVED');
        if (unapproved.length > 0) {
            throw new UnapprovedSalesPlanRowsException(
                direction,
                period.getValue(),
                unapproved.map((plan) => ({
                    id: plan.id,
                    department: plan.department,
                    category: plan.category,
                })),
            );
        }

        const existing = await this.periodRepo.findByDirectionAndPeriod(
            direction,
            period.getValue(),
        );
        const periodEntity =
            existing ??
            AccountingPeriod.openFor({
                direction,
                period: period.getValue(),
            });

        // Снапшот — только сотрудники с личной мотивационной схемой (см.
        // ShopMotivationSchemaRepositoryPort.findAllEmployeeTargets); схемы
        // на отдел здесь, как и у service, не разворачиваются.
        const rows = await this.closeShopDirection(period);

        periodEntity.close(command.closedBy, rows.length);

        await this.unitOfWork.run(async () => {
            await this.periodRepo.save(periodEntity);
            await this.snapshotRepo.saveAll(
                periodEntity.id,
                direction,
                period.getValue(),
                rows,
            );
            await this.cacheRepo.deleteByDirectionAndPeriod(
                direction,
                period.getValue(),
            );
        });

        return toAccountingPeriodResponse(
            periodEntity,
            direction,
            period.getValue(),
        );
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
