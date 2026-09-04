import type { Server } from 'http';
import { ERP_PERIOD_SYNC } from '@/shared/application/ports/erp-period-sync.port';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type { AccountingPeriodResponse } from 'ireports-contracts';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { ShopAccountingModule } from '@/domains/shop/modules/accounting/accounting.module';
// Не поднимаем AccountingModule сервиса — этот тест намеренно закрывает
// период ТОЛЬКО через ShopAccountingModule, без generic reopen/recalculate,
// чтобы граф зависимостей был максимально узким и явным.
import { WorkScheduleModule } from '@/modules/work-schedule/work-schedule.module';
import { EnsurePeriodNotClosedService } from '@/domains/service/modules/accounting/application/services/ensure-period-not-closed.service';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SHOP_CALCULATION_DATA } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import { SHOP_ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { ShopAccountingPeriodRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import { SHOP_ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type { ShopAccountingPeriodSnapshotPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import { SHOP_ACCOUNTING_CALCULATION_CACHE } from '@/domains/shop/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import type { ShopAccountingCalculationCachePort } from '@/domains/shop/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import { ShopAccountingPeriod } from '@/domains/shop/modules/accounting/domain/entities/accounting-period/accounting-period.entity';
import { ShopPeriodClosure } from '@/domains/shop/modules/accounting/domain/value-objects/period-closure.value-object';
import { Period } from '@/shared/domain/period.value-object';
import { SHOP_SALARY_ACCRUAL_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { EMPLOYEE_DISMISSAL } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';
import type { EmployeeDismissalPort } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';
import { DOMAIN_SYNC_STATUS } from '@/shared/application/ports/domain-sync-status.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import { SHOP_SALES_PLAN_REPOSITORY } from '@/domains/shop/modules/sales/application/ports/sales-plan.port';
import type { ShopSalesPlanRepositoryPort } from '@/domains/shop/modules/sales/application/ports/sales-plan.port';
import { SHOP_SALES_PERFORMANCE_READER } from '@/domains/shop/modules/sales/application/ports/sales-performance.port';
import type { ShopSalesPerformanceReaderPort } from '@/domains/shop/modules/sales/application/ports/sales-performance.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { InMemoryShopSalaryAccrualRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { DomainExceptionFilter } from '@/shared/exceptions';

// Регрессионный тест Фазы 5 docs/service-shop-boundary-violations-fix
// (пункт 4 плана): PRD фиксирует "Не в скоупе" — связь
// WorkSchedule → Service.Accounting сохраняется сознательно (график работы
// привязан только к direction='service'), и закрытие учётного периода shop
// не должно вызывать НИКАКИХ проверок/побочных эффектов в work-schedule.
// CloseShopAccountingPeriodHandler (см. WHY в самом хендлере) на уровне
// типов не знает о EnsurePeriodNotClosedService/WorkScheduleModule вовсе —
// этот тест подтверждает это поведенчески, а не только по отсутствию
// импорта: поднимает ShopAccountingModule и WorkScheduleModule В ОДНОМ
// процессе (как реальный AppModule), шпионит за
// EnsurePeriodNotClosedService.prototype.ensureNotClosed (единственная
// точка проверки "период закрыт" для work-schedule, см. WHY в самом
// сервисе) и закрывает период shop через реальный HTTP-путь — шпион не
// должен быть вызван ни разу.
describe('CloseShopAccountingPeriodHandler не задевает work-schedule (е2е, Фаза 5)', () => {
    let app: INestApplication<Server>;
    const periods = new Map<
        string,
        {
            id: string;
            status: 'OPEN' | 'CLOSED';
            closedBy: number | null;
            closedAt: Date | null;
        }
    >();
    const snapshots = new Map<string, unknown[]>();
    const accrualRepo = new InMemoryShopSalaryAccrualRepository();

    const fakeShopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort = {
        insert: () => Promise.resolve(),
        findByEmployee: () => Promise.resolve(null),
        findByDepartment: () => Promise.resolve(null),
        findByEmployees: () => Promise.resolve([]),
        findAllEmployeeTargets: () => Promise.resolve([]),
        findAllDepartmentTargets: () => Promise.resolve([]),
        findIdByTarget: () => Promise.resolve(null),
        findById: () => Promise.resolve(null),
        findAll: () => Promise.resolve([]),
        update: () => Promise.resolve(),
        initializeName: () => Promise.resolve(),
    };
    const fakeShopSalaryRuleRepo: ShopSalaryRuleRepositoryPort = {
        insert: () => Promise.resolve(),
        deleteAllByMotivationSchema: () => Promise.resolve(),
    };
    const fakeShopCalculationData: ShopCalculationDataPort = {
        findEmployeeIdentities: () => Promise.resolve([]),
        findHoursWorked: () => Promise.resolve({ fact: 0, prognose: 0 }),
        findProductSoldItems: () => Promise.resolve([]),
        findEmployeeDepartmentId: () => Promise.resolve(null),
        findEmployeesInDepartment: () => Promise.resolve([]),
        findEmployeeIdentitiesForEmployees: () => Promise.resolve(new Map()),
        findHoursWorkedForEmployees: () => Promise.resolve(new Map()),
        resolveCategoryDescendantFolderIds: () => Promise.resolve({}),
    };
    const fakeShopSalesPerformanceReader: ShopSalesPerformanceReaderPort = {
        listForPeriod: () => Promise.resolve([]),
        findForScope: () => Promise.resolve(null),
        listForDepartment: () => Promise.resolve([]),
    };
    const fakeShopAccountingPeriodRepo: ShopAccountingPeriodRepositoryPort = {
        findByPeriod: (period) => {
            const rec = periods.get(period);
            if (!rec) {
                return Promise.resolve(null);
            }
            return Promise.resolve(
                new ShopAccountingPeriod({
                    id: rec.id,
                    props: {
                        period: Period.create(period),
                        status: rec.status,
                        closure:
                            rec.closedBy !== null && rec.closedAt !== null
                                ? ShopPeriodClosure.create(
                                      rec.closedBy,
                                      rec.closedAt,
                                  )
                                : null,
                    },
                }),
            );
        },
        save: (entity) => {
            periods.set(entity.period, {
                id: entity.id,
                status: entity.status,
                closedBy: entity.closedBy,
                closedAt: entity.closedAt,
            });
            return Promise.resolve();
        },
    };
    const fakeShopAccountingPeriodSnapshot: ShopAccountingPeriodSnapshotPort = {
        saveAll: (_periodId, period, rows) => {
            snapshots.set(period, rows);
            return Promise.resolve();
        },
        findByKey: () => Promise.resolve(null),
        findManyByKey: () => Promise.resolve(new Map()),
        deleteByPeriod: (period) => {
            snapshots.delete(period);
            return Promise.resolve();
        },
    };
    const fakeShopAccountingCalculationCache: ShopAccountingCalculationCachePort =
        {
            find: () => Promise.resolve(null),
            upsert: () => Promise.resolve(),
            deleteByPeriod: () => Promise.resolve(),
        };
    const fakeEmployeeDismissal: EmployeeDismissalPort = {
        findDismissedEmployeeIds: () => Promise.resolve(new Set()),
    };
    const fakeDomainSyncStatus: DomainSyncStatusPort = {
        getLastSuccessfulSyncAt: () => Promise.resolve(null),
        markSuccessful: () => Promise.resolve(),
    };
    const fakeSalesPlanRepo: ShopSalesPlanRepositoryPort = {
        insert: () => Promise.resolve(),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        findById: () => Promise.resolve(null),
        findByIds: () => Promise.resolve([]),
        findByScope: () => Promise.resolve(null),
        // Утверждённых строк не заводим — план пуст, поэтому проверка
        // "все строки плана утверждены" в CloseShopAccountingPeriodHandler
        // пропускает без 409.
        findByPeriod: () => Promise.resolve([]),
    };
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        updateEmployeesOrder: () => Promise.resolve(),
        findServiceAccountEmployeeIds: () => Promise.resolve(new Set<number>()),
        setServiceAccount: () => Promise.resolve(null),
        findEmployees: () => Promise.resolve([]),
    };
    const fakeUnitOfWork: UnitOfWorkPort = { run: (work) => work() };
    const fakeDatabaseService = {} as unknown as DatabaseService;

    @Global()
    @Module({
        providers: [
            { provide: UNIT_OF_WORK, useValue: fakeUnitOfWork },
            { provide: DatabaseService, useValue: fakeDatabaseService },
        ],
        exports: [UNIT_OF_WORK, DatabaseService],
    })
    class FakeInfrastructureModule {}

    // Шпион на прототипе — перехватывает вызов на ЛЮБОМ экземпляре
    // EnsurePeriodNotClosedService, включая тот, что реально создаст Nest
    // DI внутри WorkScheduleModule (см. work-schedule.module.ts). Если бы
    // CloseShopAccountingPeriodHandler где-то (прямо или через общий
    // CommandBus/EventBus) вызывал эту проверку — шпион бы это поймал.
    const ensureNotClosedSpy = jest.spyOn(
        EnsurePeriodNotClosedService.prototype,
        'ensureNotClosed',
    );

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [
                EventEmitterModule.forRoot(),
                FakeInfrastructureModule,
                ShopAccountingModule,
                // Сохранённое исключение PRD ("Не в скоупе") — work-schedule
                // поднят В ТОМ ЖЕ процессе, как в реальном AppModule, чтобы
                // проверка была поведенческой, а не только по отсутствию
                // импорта в графе типов.
                WorkScheduleModule,
            ],
        })
            .overrideProvider(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
            .useValue(fakeShopMotivationSchemaRepo)
            .overrideProvider(SHOP_SALARY_RULE_REPOSITORY)
            .useValue(fakeShopSalaryRuleRepo)
            .overrideProvider(SHOP_CALCULATION_DATA)
            .useValue(fakeShopCalculationData)
            .overrideProvider(SHOP_SALES_PERFORMANCE_READER)
            .useValue(fakeShopSalesPerformanceReader)
            .overrideProvider(SHOP_ACCOUNTING_PERIOD_REPOSITORY)
            .useValue(fakeShopAccountingPeriodRepo)
            .overrideProvider(SHOP_ACCOUNTING_PERIOD_SNAPSHOT)
            .useValue(fakeShopAccountingPeriodSnapshot)
            .overrideProvider(SHOP_ACCOUNTING_CALCULATION_CACHE)
            .useValue(fakeShopAccountingCalculationCache)
            .overrideProvider(SHOP_SALARY_ACCRUAL_REPOSITORY)
            .useValue(accrualRepo)
            // Неявная синхронизация ERP внутри закрытия (Фаза 2 PRD 1
            // docs/payroll-closing-and-accrual) — в e2e заменена no-op:
            // реальная ERP недоступна.
            .overrideProvider(ERP_PERIOD_SYNC)
            .useValue({ syncPeriod: () => Promise.resolve() })
            .overrideProvider(EMPLOYEE_DISMISSAL)
            .useValue(fakeEmployeeDismissal)
            .overrideProvider(DOMAIN_SYNC_STATUS)
            .useValue(fakeDomainSyncStatus)
            .overrideProvider(SHOP_SALES_PLAN_REPOSITORY)
            .useValue(fakeSalesPlanRepo)
            .overrideProvider(DIRECTORY_REPOSITORY)
            .useValue(fakeDirectoryRepo)
            .compile();

        app = moduleRef.createNestApplication();
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(req, res, next),
        );
        app.useGlobalPipes(new ZodValidationPipe());
        app.useGlobalFilters(new DomainExceptionFilter());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
        ensureNotClosedSpy.mockRestore();
    });

    it('закрытие периода shop не вызывает EnsurePeriodNotClosedService (work-schedule) ни разу', async () => {
        expect(ensureNotClosedSpy).not.toHaveBeenCalled();

        const response = await request(app.getHttpServer())
            .post('/v1/shop/accounting/period/2026-07/close')
            .send({ closedBy: 1 })
            .expect(201);

        expect((response.body as AccountingPeriodResponse).status).toBe(
            'CLOSED',
        );
        // Единственная точка проверки "период закрыт" для work-schedule
        // (см. WHY в самом сервисе) не была затронута закрытием периода
        // shop — сохранённое исключение PRD выполняется, а не случайно
        // работает благодаря отсутствию нагрузки.
        expect(ensureNotClosedSpy).not.toHaveBeenCalled();
    });
});
