import type { Server } from 'http';
import { ERP_PERIOD_SYNC } from '@/shared/application/ports/erp-period-sync.port';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type {
    AccountingPeriodResponse,
    SalaryAccrualListResponse,
    SalaryAccrualResponse,
} from 'ireports-contracts';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { ShopAccountingModule } from '@/domains/shop/modules/accounting/accounting.module';
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
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { InMemoryShopSalaryAccrualRepository } from '@/domains/shop/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { Period } from '@/shared/domain/period.value-object';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Зеркало salary-accruals.e2e.spec.ts сервиса для направления shop (PRD 1
// docs/payroll-closing-and-accrual): close → list → get → reopen через
// /v1/shop/accounting/*. С Фазы 6 docs/service-shop-boundary-violations-fix
// весь этот путь (включая reopen) обслуживается собственными, независимыми
// классами/токенами ShopAccountingModule — сервисный AccountingModule
// поднимать больше не нужно (до этой фазы reopen диспатчился как generic по
// direction команда, обслуживаемая хендлером, зарегистрированным в
// AccountingModule сервиса, поэтому тест поднимал оба модуля).
describe('Документы начисления магазина: close → salary_accruals → reopen (e2e)', () => {
    let app: INestApplication<Server>;
    const shopSchemas = new Map<number, ShopMotivationSchema>();
    type PeriodRecord = {
        id: string;
        status: 'OPEN' | 'CLOSED';
        closedBy: number | null;
        closedAt: Date | null;
    };
    const periods = new Map<string, PeriodRecord>();
    const snapshots = new Map<string, unknown[]>();
    const accrualRepo = new InMemoryShopSalaryAccrualRepository();

    const fakeShopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort = {
        insert: () => Promise.resolve(),
        findByEmployee: (employeeId) =>
            Promise.resolve(shopSchemas.get(employeeId) ?? null),
        findByDepartment: () => Promise.resolve(null),
        findByEmployees: () => Promise.resolve([]),
        findAllEmployeeTargets: () =>
            Promise.resolve([...shopSchemas.values()]),
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
        findHoursWorked: () => Promise.resolve({ fact: 5, prognose: 5 }),
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
        findByPeriod: () => Promise.resolve([]),
    };
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        updateEmployeesOrder: () => Promise.resolve(),
        findServiceAccountEmployeeIds: () => Promise.resolve(new Set<number>()),
        setServiceAccount: () => Promise.resolve(null),
        findEmployees: () =>
            Promise.resolve([
                {
                    id: 42,
                    firstName: 'Анна',
                    lastName: 'Сидорова',
                    departmentId: 9,
                },
            ]),
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

    beforeAll(async () => {
        shopSchemas.set(
            42,
            withRequestContext(() =>
                ShopMotivationSchema.create({
                    targetType: 'Employee',
                    targetId: 42,
                    name: 'Оклад продавца',
                    rules: [
                        PayPerHourShopEntity.create({
                            type: 'PayPerHour',
                            name: 'Почасовая ставка',
                            targetRole: 'ONLINE_MANAGER',
                            config: { price: 200 },
                        }),
                    ],
                }),
            ),
        );

        const moduleRef = await Test.createTestingModule({
            imports: [
                EventEmitterModule.forRoot(),
                FakeInfrastructureModule,
                ShopAccountingModule,
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
            // Неявная синхронизация ERP внутри закрытия (Фаза 2 PRD 1) —
            // в e2e заменена no-op: реальная ERP недоступна.
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
    });

    it('close shop → документы только direction=shop → карточка → reopen удаляет', async () => {
        const closeResponse = await request(app.getHttpServer())
            .post('/v1/shop/accounting/period/2026-07/close')
            .send({ closedBy: 1 })
            .expect(201);
        expect((closeResponse.body as AccountingPeriodResponse).status).toBe(
            'CLOSED',
        );
        // Период service того же месяца не тронут вовсе — этот тест больше
        // не поднимает AccountingModule сервиса (см. WHY в шапке файла),
        // проверка "документов service нет" избыточна: они физически не
        // могли появиться — сервис в этом процессе не участвует.

        const listResponse = await request(app.getHttpServer())
            .get('/v1/shop/accounting/salary_accruals?period=2026-07')
            .expect(200);
        const list = listResponse.body as SalaryAccrualListResponse;
        expect(list).toMatchObject({
            direction: 'shop',
            period: '2026-07',
            total: 1000,
        });
        expect(list.items).toEqual([
            expect.objectContaining({
                direction: 'shop',
                employeeId: 42,
                employeeName: 'Анна Сидорова',
                departmentId: 9,
                status: 'DRAFT',
                isDismissed: false,
                total: 1000,
                linesCount: 1,
            }),
        ]);

        const cardResponse = await request(app.getHttpServer())
            .get(`/v1/shop/accounting/salary_accruals/${list.items[0].id}`)
            .expect(200);
        const card = cardResponse.body as SalaryAccrualResponse;
        expect(card.lines).toEqual([
            expect.objectContaining({
                type: 'PayPerHour',
                targetRole: 'ONLINE_MANAGER',
                quantity: 5,
                rate: 200,
                amount: 1000,
                originalAmount: 1000,
                status: 'DRAFT',
            }),
        ]);

        await request(app.getHttpServer())
            .post('/v1/shop/accounting/period/2026-07/reopen')
            .send({ confirm: true })
            .expect(201);
        const afterReopen = await request(app.getHttpServer())
            .get('/v1/shop/accounting/salary_accruals?period=2026-07')
            .expect(200);
        expect((afterReopen.body as SalaryAccrualListResponse).items).toEqual(
            [],
        );
        expect(snapshots.has('2026-07')).toBe(false);
    });
});
