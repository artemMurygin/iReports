import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import type { SalaryAccrualRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { EMPLOYEE_DISMISSAL } from '@/domains/service/modules/accounting/application/ports/employee-dismissal.port';
import type { EmployeeDismissalPort } from '@/domains/service/modules/accounting/application/ports/employee-dismissal.port';
import { SalaryAccrual } from '@/domains/service/modules/accounting/domain/entities/salary-accrual.entity';
import { SalaryAccrualDocumentsCreatedDomainEvent } from '@/domains/service/modules/accounting/domain/events/salary-accrual-documents-created.domain-event';
import { BuildShopCalculationContextService } from '@/domains/shop/modules/accounting/application/services/build-shop-calculation-context.service';
import { ResolveShopEmployeeSalaryRulesService } from '@/domains/shop/modules/accounting/application/services/resolve-shop-employee-salary-rules.service';
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
//
// PRD 1 docs/payroll-closing-and-accrual (Фаза 1) — документы начисления,
// зеркально CloseAccountingPeriodHandler сервиса, но своим кодом (общего
// хендлера нет): сброс кэша до расчёта, документ SalaryAccrual (DRAFT) на
// каждую строку снапшота, включая нулевые и уволенных (isDismissed по
// активности BitrixEmployee), в той же транзакции UnitOfWork, что снапшот и
// CLOSED; после коммита — SalaryAccrualDocumentsCreatedDomainEvent.
// SalaryAccrual/порты документа физически лежат в domains/service/modules/
// accounting, но direction-агностичны (см. шапку выше про AccountingPeriod).
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
        @Inject(SALES_PLAN_REPOSITORY)
        private readonly salesPlanRepo: SalesPlanRepositoryPort,
        @Inject(SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: SalaryAccrualRepositoryPort,
        @Inject(EMPLOYEE_DISMISSAL)
        private readonly employeeDismissal: EmployeeDismissalPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
        private readonly eventEmitter: EventEmitter2,
        private readonly shopContextBuilder: BuildShopCalculationContextService,
        private readonly salaryRulesResolver: ResolveShopEmployeeSalaryRulesService,
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

        // Сброс кэша ДО расчёта (PRD 1: "закрытие никогда не фиксирует
        // устаревший кэш"); повторное удаление внутри транзакции — чтобы не
        // оставить строки, записанные отчётом между сбросом и коммитом.
        await this.cacheRepo.deleteByDirectionAndPeriod(
            direction,
            period.getValue(),
        );

        // Снапшот — все сотрудники, у которых есть зарплатные правила: с
        // личной схемой и/или со схемой на их отдел (см.
        // ResolveShopEmployeeSalaryRulesService.forAllTargets).
        const rows = await this.closeShopDirection(period);
        const accruals = await this.buildAccrualDocuments(period, rows);

        periodEntity.close(command.closedBy, rows.length);

        await this.unitOfWork.run(async () => {
            await this.periodRepo.save(periodEntity);
            await this.snapshotRepo.saveAll(
                periodEntity.id,
                direction,
                period.getValue(),
                rows,
            );
            await this.accrualRepo.saveAll(
                direction,
                period.getValue(),
                accruals,
            );
            await this.cacheRepo.deleteByDirectionAndPeriod(
                direction,
                period.getValue(),
            );
        });

        // unitOfWork.run резолвится только после коммита (см.
        // DatabaseService.withTransaction) — событие не уйдёт при откате.
        await this.eventEmitter.emitAsync(
            SalaryAccrualDocumentsCreatedDomainEvent.name,
            new SalaryAccrualDocumentsCreatedDomainEvent({
                aggregateId: periodEntity.id,
                direction,
                period: period.getValue(),
                accrualIds: accruals.map((accrual) => accrual.id),
            }),
        );

        return toAccountingPeriodResponse(
            periodEntity,
            direction,
            period.getValue(),
        );
    }

    private async closeShopDirection(
        period: Period,
    ): Promise<AccountingPeriodSnapshotRow[]> {
        const salaryRulesByEmployee =
            await this.salaryRulesResolver.forAllTargets();
        const rows: AccountingPeriodSnapshotRow[] = [];
        for (const [employeeId, { rules }] of salaryRulesByEmployee) {
            // Сотрудник отдела со схемой, у которого после фильтра по
            // direction='shop' не осталось ни одного правила (вся схема
            // отдела — правила сервиса), в снапшот не попадает: пустая
            // строка на нулевую сумму завысила бы closedRows и ничего не
            // фиксировала бы.
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

    // Документ на КАЖДУЮ строку снапшота, включая нулевые суммы и уволенных
    // (isDismissed) — см. PRD 1, "Документы начисления".
    private async buildAccrualDocuments(
        period: Period,
        rows: AccountingPeriodSnapshotRow[],
    ): Promise<SalaryAccrual[]> {
        const dismissed = await this.employeeDismissal.findDismissedEmployeeIds(
            rows.map((row) => row.employeeId),
        );
        return rows.map((row) =>
            SalaryAccrual.createFromSnapshot({
                direction: 'shop',
                period: period.getValue(),
                employeeId: row.employeeId,
                isDismissed: dismissed.has(row.employeeId),
                total: row.total,
                lines: row.lines,
            }),
        );
    }
}
