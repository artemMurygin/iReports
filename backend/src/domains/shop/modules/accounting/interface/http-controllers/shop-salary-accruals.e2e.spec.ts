import type { Server } from 'http';
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
import { ShopAccountingModule } from '@/domains/shop/modules/accounting/shop-accounting.module';
// ReopenAccountingPeriodHandler зарегистрирован в AccountingModule сервиса
// (generic по direction, см. shop-accounting.module.ts) — для сквозного
// reopen поднимаем и его, как это делает реальное приложение.
import { AccountingModule } from '@/domains/service/modules/accounting/accounting.module';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-salary-rule.port';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-salary-rule.port';
import { SHOP_TASK_COMPLETION_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-task-completion.port';
import type { ShopTaskCompletionRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-task-completion.port';
import { SHOP_CALCULATION_DATA } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import { SERVICE_CALCULATION_DATA } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import { ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type {
    AccountingPeriodSnapshotPort,
    AccountingPeriodSnapshotRow,
} from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import { ACCOUNTING_CALCULATION_CACHE } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual.port';
import { EMPLOYEE_DISMISSAL } from '@/domains/service/modules/accounting/application/ports/employee-dismissal.port';
import type { EmployeeDismissalPort } from '@/domains/service/modules/accounting/application/ports/employee-dismissal.port';
import { DOMAIN_SYNC_STATUS } from '@/shared/application/ports/domain-sync-status.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { SHOP_SALES_PERFORMANCE_READER } from '@/domains/shop/modules/sales/application/ports/shop-sales-performance.port';
import type { ShopSalesPerformanceReaderPort } from '@/domains/shop/modules/sales/application/ports/shop-sales-performance.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/testing/in-memory-salary-accrual.repository';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Зеркало salary-accruals.e2e.spec.ts сервиса для направления shop (PRD 1
// docs/payroll-closing-and-accrual): close → list → get → reopen через
// /v1/shop/accounting/*. Поднимаются оба accounting-модуля, как в реальном
// приложении: close/list/get обслуживает ShopAccountingModule, reopen —
// generic ReopenAccountingPeriodHandler из AccountingModule сервиса через
// общий CommandBus. Все in-memory фейки общие (один AccountingPeriod/снапшот/
// документ на оба модуля) — у них один ключ (direction, period), и тест
// заодно проверяет, что закрытие shop не порождает документов service.
describe('Документы начисления магазина: close → salary_accruals → reopen (e2e)', () => {
    let app: INestApplication<Server>;
    const shopSchemas = new Map<number, ShopMotivationSchema>();
    const periods = new Map<string, AccountingPeriod>();
    const snapshots = new Map<string, AccountingPeriodSnapshotRow[]>();
    const accrualRepo = new InMemorySalaryAccrualRepository();
    const periodKey = (direction: string, period: string) =>
        `${direction}:${period}`;

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
    const fakeShopTaskCompletionRepo: ShopTaskCompletionRepositoryPort = {
        insert: () => Promise.resolve(),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        findById: () => Promise.resolve(null),
        findByPeriod: () => Promise.resolve([]),
        findConfirmedByPeriod: () => Promise.resolve([]),
    };
    const fakeShopCalculationData: ShopCalculationDataPort = {
        findEmployeeIdentities: () => Promise.resolve([]),
        findHoursWorked: () => Promise.resolve(5),
        findProductSoldItems: () => Promise.resolve([]),
        findConfirmedTaskCompletions: () => Promise.resolve([]),
        findEmployeeDepartmentId: () => Promise.resolve(null),
        findEmployeesInDepartment: () => Promise.resolve([]),
        findEmployeeIdentitiesForEmployees: () => Promise.resolve(new Map()),
        findHoursWorkedForEmployees: () => Promise.resolve(new Map()),
        resolveCategoryDescendantFolderIds: () => Promise.resolve({}),
    };
    const fakeShopSalesPerformanceReader: ShopSalesPerformanceReaderPort = {
        listForPeriod: () => Promise.resolve([]),
        findForScope: () => Promise.resolve(null),
    };
    // Сервисный AccountingModule поднят только ради ReopenAccountingPeriodHandler
    // — его источники данных пустые.
    const fakeMotivationSchemaRepo: MotivationSchemaRepositoryPort = {
        insert: () => Promise.resolve(),
        findByEmployee: () => Promise.resolve(null),
        findByEmployees: () => Promise.resolve([]),
        findAllEmployeeTargets: () => Promise.resolve([]),
        findByDepartment: () => Promise.resolve(null),
        findAllDepartmentTargets: () => Promise.resolve([]),
        findIdByTarget: () => Promise.resolve(null),
        findById: () => Promise.resolve(null),
        findAll: () => Promise.resolve([]),
        update: () => Promise.resolve(),
        initializeName: () => Promise.resolve(),
    };
    const fakeSalaryRuleRepo: SalaryRuleRepositoryPort = {
        insert: () => Promise.resolve(),
        deleteAllByMotivationSchema: () => Promise.resolve(),
    };
    const fakeServiceCalculationData: ServiceCalculationDataPort = {
        findEmployeeIdentities: () => Promise.resolve([]),
        findServiceCompletedItems: () => Promise.resolve([]),
        findHoursWorked: () => Promise.resolve(0),
        findOrderPayedItems: () => Promise.resolve([]),
        findConfirmedTaskCompletions: () => Promise.resolve([]),
        findEmployeeDepartmentId: () => Promise.resolve(null),
        findEmployeesInDepartment: () => Promise.resolve([]),
        findEmployeeIdentitiesForEmployees: () => Promise.resolve(new Map()),
        findHoursWorkedForEmployees: () => Promise.resolve(new Map()),
    };
    const fakeAccountingPeriodRepo: AccountingPeriodRepositoryPort = {
        findByDirectionAndPeriod: (direction, period) =>
            Promise.resolve(periods.get(periodKey(direction, period)) ?? null),
        save: (entity) => {
            periods.set(periodKey(entity.direction, entity.period), entity);
            return Promise.resolve();
        },
    };
    const fakeAccountingPeriodSnapshot: AccountingPeriodSnapshotPort = {
        saveAll: (_periodId, direction, period, rows) => {
            snapshots.set(periodKey(direction, period), rows);
            return Promise.resolve();
        },
        findByKey: () => Promise.resolve(null),
        findManyByKey: () => Promise.resolve(new Map()),
        deleteByDirectionAndPeriod: (direction, period) => {
            snapshots.delete(periodKey(direction, period));
            return Promise.resolve();
        },
    };
    const fakeAccountingCalculationCache: AccountingCalculationCachePort = {
        find: () => Promise.resolve(null),
        upsert: () => Promise.resolve(),
        deleteByDirectionAndPeriod: () => Promise.resolve(),
    };
    const fakeEmployeeDismissal: EmployeeDismissalPort = {
        findDismissedEmployeeIds: () => Promise.resolve(new Set()),
    };
    const fakeDomainSyncStatus: DomainSyncStatusPort = {
        getLastSuccessfulSyncAt: () => Promise.resolve(null),
        markSuccessful: () => Promise.resolve(),
    };
    const fakeSalesPlanRepo: SalesPlanRepositoryPort = {
        insert: () => Promise.resolve(),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        findById: () => Promise.resolve(null),
        findByIds: () => Promise.resolve([]),
        findByScope: () => Promise.resolve(null),
        findByDirectionAndPeriod: () => Promise.resolve([]),
    };
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
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
                AccountingModule,
            ],
        })
            .overrideProvider(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
            .useValue(fakeShopMotivationSchemaRepo)
            .overrideProvider(SHOP_SALARY_RULE_REPOSITORY)
            .useValue(fakeShopSalaryRuleRepo)
            .overrideProvider(SHOP_TASK_COMPLETION_REPOSITORY)
            .useValue(fakeShopTaskCompletionRepo)
            .overrideProvider(SHOP_CALCULATION_DATA)
            .useValue(fakeShopCalculationData)
            .overrideProvider(SHOP_SALES_PERFORMANCE_READER)
            .useValue(fakeShopSalesPerformanceReader)
            .overrideProvider(MOTIVATION_SCHEMA_REPOSITORY)
            .useValue(fakeMotivationSchemaRepo)
            .overrideProvider(SALARY_RULE_REPOSITORY)
            .useValue(fakeSalaryRuleRepo)
            .overrideProvider(SERVICE_CALCULATION_DATA)
            .useValue(fakeServiceCalculationData)
            .overrideProvider(ACCOUNTING_PERIOD_REPOSITORY)
            .useValue(fakeAccountingPeriodRepo)
            .overrideProvider(ACCOUNTING_PERIOD_SNAPSHOT)
            .useValue(fakeAccountingPeriodSnapshot)
            .overrideProvider(ACCOUNTING_CALCULATION_CACHE)
            .useValue(fakeAccountingCalculationCache)
            .overrideProvider(SALARY_ACCRUAL_REPOSITORY)
            .useValue(accrualRepo)
            .overrideProvider(EMPLOYEE_DISMISSAL)
            .useValue(fakeEmployeeDismissal)
            .overrideProvider(DOMAIN_SYNC_STATUS)
            .useValue(fakeDomainSyncStatus)
            .overrideProvider(SALES_PLAN_REPOSITORY)
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
        // Период service того же месяца не тронут, документов service нет.
        expect(periods.has(periodKey('service', '2026-07'))).toBe(false);
        const serviceList = await request(app.getHttpServer())
            .get('/v1/service/accounting/salary_accruals?period=2026-07')
            .expect(200);
        expect((serviceList.body as SalaryAccrualListResponse).items).toEqual(
            [],
        );

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
        // Документ shop под путём service не отдаётся.
        await request(app.getHttpServer())
            .get(`/v1/service/accounting/salary_accruals/${list.items[0].id}`)
            .expect(404);

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
        expect(snapshots.has(periodKey('shop', '2026-07'))).toBe(false);
    });
});
