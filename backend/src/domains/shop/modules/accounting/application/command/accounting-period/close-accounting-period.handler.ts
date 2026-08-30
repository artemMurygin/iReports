import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { Period } from '@/shared/domain/period.value-object';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import { ShopAccountingPeriod } from '@/domains/shop/modules/accounting/domain/entities/accounting-period/accounting-period.entity';
import {
    ShopPeriodAlreadyClosedException,
    ShopPeriodNotExpiredException,
    ShopUnapprovedSalesPlanRowsException,
} from '@/domains/shop/modules/accounting/domain/exceptions/accounting-period.exception';
import { ErpPeriodSyncRunner } from '@/shared/application/services/erp-period-sync-runner.service';
import { SHOP_ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { ShopAccountingPeriodRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import { SHOP_ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type {
    ShopAccountingPeriodSnapshotPort,
    ShopAccountingPeriodSnapshotRow,
} from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import { SHOP_ACCOUNTING_CALCULATION_CACHE } from '@/domains/shop/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import type { ShopAccountingCalculationCachePort } from '@/domains/shop/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import { SHOP_SALES_PLAN_REPOSITORY } from '@/domains/shop/modules/sales/application/ports/sales-plan.port';
import type { ShopSalesPlanRepositoryPort } from '@/domains/shop/modules/sales/application/ports/sales-plan.port';
import { ShopAccountingPeriodMapper } from '@/domains/shop/modules/accounting/infrastructure/mappers/accounting-period/accounting-period.mapper';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import type { ShopSalaryAccrualRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { EMPLOYEE_DISMISSAL } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';
import type { EmployeeDismissalPort } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';
import { ShopSalaryAccrual } from '@/domains/shop/modules/accounting/domain/entities/salary-accrual/salary-accrual.entity';
// SalaryAccrualDocumentsCreatedDomainEvent остаётся общим,
// direction-агностичным событием (Фаза 6 docs/service-shop-boundary-violations-fix
// не дублирует его — см. WHY в самом файле события и в
// SalaryAccrualDocumentsCreatedEventHandler): у события уже есть поле
// direction, единственный текущий подписчик — временный лог-хендлер,
// подтверждающий публикацию для обоих направлений.
import { SalaryAccrualDocumentsCreatedDomainEvent } from '@/shared/domain/events/salary-accrual-documents-created.domain-event';
import { CalculateShopSnapshotRowsService } from '@/domains/shop/modules/accounting/application/services/calculation/calculate-snapshot-rows.service';
import { CloseShopAccountingPeriodCommand } from './close-accounting-period.command';

// Закрытие расчётного периода направления shop (Фаза 13.5, issue #57) —
// независимый CQRS-вход, выделенный из CloseAccountingPeriodHandler
// (domains/service/modules/accounting), который до этой правки обслуживал
// оба направления через direction в команде и приватный closeShopDirection().
// direction здесь не поле команды/аргумент — он зафиксирован самим
// расположением класса в домене shop (см. также
// CloseAccountingPeriodHandler — зеркальный независимый вход для service).
//
// Порт/сущность периода, снапшота и кэша расчёта — собственные независимые
// классы/токены domains/shop (Фаза 5 docs/service-shop-boundary-violations-fix),
// без переиспользования кода domains/service/modules/accounting; таблицы в
// БД при этом остаются общими (partitioned по direction, см. WHY в
// accounting-period.repository.ts). Порт плана продаж
// (SHOP_SALES_PLAN_REPOSITORY) — с Фазы 7 (docs/service-shop-boundary-violations-fix)
// тоже собственный, независимый от domains/service/modules/sales
// порт/репозиторий направления shop (закрывает §2.3/§4 аудита).
//
// Логика:
// 1) отклоняется, если есть хоть одна неутверждённая строка плана продаж
//    периода направления shop;
// 2) иначе снимает FACT-срез по каждому сотруднику с личной shop-
//    мотивационной схемой (тем же оркестратором, что и открытый расчёт) и
//    фиксирует его неизменяемым снапшотом;
// 3) переводит период в CLOSED и порождает ShopAccountingPeriodClosedDomainEvent.
//
// PRD 1 docs/payroll-closing-and-accrual (Фаза 1) — документы начисления,
// зеркально CloseAccountingPeriodHandler сервиса, но своим кодом (общего
// хендлера нет): сброс кэша до расчёта, документ SalaryAccrual (DRAFT) на
// каждую строку снапшота, включая нулевые и уволенных (isDismissed по
// активности BitrixEmployee), в той же транзакции UnitOfWork, что снапшот и
// CLOSED; после коммита — SalaryAccrualDocumentsCreatedDomainEvent.
// ShopSalaryAccrual/порты документа — с Фазы 6
// docs/service-shop-boundary-violations-fix собственные независимые классы/
// токены domains/shop (не переиспользуют domains/service): общая таблица
// salary_accruals остаётся физически одной (partitioned по direction),
// изоляция — на уровне кода (см. WHY в salary-accrual.repository.ts).
//
// Фаза 2 PRD 1 — зеркально сервису: только истёкший и ещё не закрытый
// месяц (409 иначе), неявная синхронизация отгрузок МойСклада за месяц
// (ErpPeriodSyncRunner → ERP_PERIOD_SYNC, таймаут 2 мин, блокировка
// направления от тика крона; ошибка → ErpSyncFailedException, период
// открыт, ничего не создано) до сброса кэша и расчёта; строки снапшота
// считает CalculateShopSnapshotRowsService — тот же код, что и close-preview.
@CommandHandler(CloseShopAccountingPeriodCommand)
export class CloseShopAccountingPeriodHandler implements ICommandHandler<
    CloseShopAccountingPeriodCommand,
    AccountingPeriodResponse
> {
    private readonly mapper = new ShopAccountingPeriodMapper();

    constructor(
        @Inject(SHOP_ACCOUNTING_PERIOD_REPOSITORY)
        private readonly periodRepo: ShopAccountingPeriodRepositoryPort,
        @Inject(SHOP_ACCOUNTING_PERIOD_SNAPSHOT)
        private readonly snapshotRepo: ShopAccountingPeriodSnapshotPort,
        @Inject(SHOP_ACCOUNTING_CALCULATION_CACHE)
        private readonly cacheRepo: ShopAccountingCalculationCachePort,
        @Inject(SHOP_SALES_PLAN_REPOSITORY)
        private readonly salesPlanRepo: ShopSalesPlanRepositoryPort,
        @Inject(SHOP_SALARY_ACCRUAL_REPOSITORY)
        private readonly accrualRepo: ShopSalaryAccrualRepositoryPort,
        @Inject(EMPLOYEE_DISMISSAL)
        private readonly employeeDismissal: EmployeeDismissalPort,
        @Inject(UNIT_OF_WORK)
        private readonly unitOfWork: UnitOfWorkPort,
        private readonly eventEmitter: EventEmitter2,
        private readonly rowsCalculator: CalculateShopSnapshotRowsService,
        private readonly erpSync: ErpPeriodSyncRunner,
    ) {}

    async execute(
        command: CloseShopAccountingPeriodCommand,
    ): Promise<AccountingPeriodResponse> {
        const direction = 'shop' as const;
        const period = Period.create(command.period);

        if (!period.isExpired()) {
            throw new ShopPeriodNotExpiredException(period.getValue());
        }

        const plans = await this.salesPlanRepo.findByPeriod(period.getValue());
        const unapproved = plans.filter((plan) => plan.status !== 'APPROVED');
        if (unapproved.length > 0) {
            throw new ShopUnapprovedSalesPlanRowsException(
                period.getValue(),
                unapproved.map((plan) => ({
                    id: plan.id,
                    department: plan.department,
                    category: plan.category,
                })),
            );
        }

        const existing = await this.periodRepo.findByPeriod(period.getValue());
        if (existing?.isClosed()) {
            throw new ShopPeriodAlreadyClosedException(period.getValue());
        }
        const periodEntity =
            existing ?? ShopAccountingPeriod.openFor(period.getValue());

        // Неявная синхронизация ERP за месяц — до транзакции закрытия и до
        // сброса кэша; её результат остаётся в БД даже при отклонении ниже.
        await this.erpSync.run(direction, period);

        // Сброс кэша ДО расчёта (PRD 1: "закрытие никогда не фиксирует
        // устаревший кэш"); повторное удаление внутри транзакции — чтобы не
        // оставить строки, записанные отчётом между сбросом и коммитом.
        await this.cacheRepo.deleteByPeriod(period.getValue());

        // Снапшот — все сотрудники, у которых есть зарплатные правила: с
        // личной схемой и/или со схемой на их отдел (см.
        // ResolveShopEmployeeSalaryRulesService.forAllTargets).
        const rows = await this.rowsCalculator.calculate(period);
        const accruals = await this.buildAccrualDocuments(period, rows);

        periodEntity.close(command.closedBy, rows.length);

        await this.unitOfWork.run(async () => {
            await this.periodRepo.save(periodEntity);
            await this.snapshotRepo.saveAll(
                periodEntity.id,
                period.getValue(),
                rows,
            );
            await this.accrualRepo.saveAll(period.getValue(), accruals);
            await this.cacheRepo.deleteByPeriod(period.getValue());
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

        return this.mapper.toResponse(periodEntity, period.getValue());
    }

    // Документ на КАЖДУЮ строку снапшота, включая нулевые суммы и уволенных
    // (isDismissed) — см. PRD 1, "Документы начисления".
    private async buildAccrualDocuments(
        period: Period,
        rows: ShopAccountingPeriodSnapshotRow[],
    ): Promise<ShopSalaryAccrual[]> {
        const dismissed = await this.employeeDismissal.findDismissedEmployeeIds(
            rows.map((row) => row.employeeId),
        );
        return rows.map((row) =>
            ShopSalaryAccrual.createFromSnapshot({
                period: period.getValue(),
                employeeId: row.employeeId,
                isDismissed: dismissed.has(row.employeeId),
                total: row.total,
                lines: row.lines,
            }),
        );
    }
}
