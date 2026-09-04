import type { Server } from 'http';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type { BalanceSummaryResponse } from 'ireports-contracts';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { AccountingModule } from '@/domains/service/modules/accounting/accounting.module';
import { EmployeeBalanceModule } from '@/modules/employee-balance/employee-balance.module';
import { ERP_PERIOD_SYNC } from '@/shared/application/ports/erp-period-sync.port';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period.port';
import { ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import { ACCOUNTING_CALCULATION_CACHE } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import type { AccountingCalculationCachePort } from '@/domains/service/modules/accounting/application/ports/accounting-calculation-cache.port';
import { SALARY_ACCRUAL_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-accrual/salary-accrual.port';
import { BALANCE_TRANSACTION_REPOSITORY } from '@/modules/employee-balance/application/ports/balance-transaction.port';
import { EMPLOYEE_DISMISSAL } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';
import type { EmployeeDismissalPort } from '@/modules/employee-dismissal/application/ports/employee-dismissal.port';
import { DOMAIN_SYNC_STATUS } from '@/shared/application/ports/domain-sync-status.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { SERVICE_CALCULATION_DATA } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { SERVICE_ERP_CASH_DOCUMENT_PORT } from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import type { ErpCashDocumentPort } from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import { SHOP_ERP_CASH_DOCUMENT_PORT } from '@/domains/shop/modules/accounting/application/ports/cashbox/cashbox-document.port';
import { PAYOUT_CASHBOX_RECORD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/payout-cashbox-record-repository.port';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { InMemoryBalanceTransactionRepository } from '@/modules/employee-balance/infrastructure/repositories/in-memory-balance-transaction.repository';
import { InMemoryPayoutCashboxRecordRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/erp-cash/in-memory-payout-cashbox-record.repository';
import { BalanceTransaction } from '@/modules/employee-balance/domain/entities/balance-transaction.entity';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Сквозной список взаиморасчётов (docs/employee-settlements-page-redesign,
// Фаза 1, GET /v1/accounting/balance/summary/:period) — e2e поверх реального
// AccountingModule/CommandBus/контроллера, тот же приём границы БД/внешних
// систем через in-memory фейки, что и balance-transactions.e2e.spec.ts
// (отдельный файл — состояние ленты там накапливается по сценариям
// сквозного PRD 2/3 и не подходит для точечных числовых проверок KPI/дат
// последнего движения здесь).
describe('Фаза 1 docs/employee-settlements-page-redesign: сквозной список взаиморасчётов (e2e)', () => {
    let app: INestApplication<Server>;
    const transactionRepo = new InMemoryBalanceTransactionRepository();

    const departments = [
        { id: 5, name: 'Сервис' },
        { id: 6, name: 'Магазин' },
    ];
    const employees = [
        {
            id: 42,
            firstName: 'Иван',
            lastName: 'Петров',
            departmentId: 5,
            position: 'Инженер',
        },
        {
            id: 43,
            firstName: 'Пётр',
            lastName: 'Сидоров',
            departmentId: 5,
            position: null,
        },
        {
            id: 44,
            firstName: 'Анна',
            lastName: 'Кузнецова',
            departmentId: 6,
            position: 'Продавец',
        },
    ];
    // Сотрудник 43 уволен (BitrixEmployee.isActive = false) — остаётся в
    // списке взаиморасчётов из-за ненулевого баланса, с бейджем «Уволен»
    // (PRD, "Не в скоупе"/"В скоупе": уволенный с ненулевым остатком).
    const dismissedEmployeeIds = new Set([43]);

    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve(departments),
        updateEmployeesOrder: () => Promise.resolve(),
        findEmployees: (departmentId) =>
            Promise.resolve(
                employees.filter(
                    (employee) =>
                        departmentId === undefined ||
                        employee.departmentId === departmentId,
                ),
            ),
        findServiceAccountEmployeeIds: () => Promise.resolve(new Set<number>()),
        setServiceAccount: () => Promise.resolve(null),
    };
    const fakeEmployeeDismissal: EmployeeDismissalPort = {
        findDismissedEmployeeIds: (employeeIds) =>
            Promise.resolve(
                new Set(
                    employeeIds.filter((id) => dismissedEmployeeIds.has(id)),
                ),
            ),
    };
    // Фейки остальных портов модуля — не задействованы этим срезом
    // контроллеров, но нужны, чтобы AccountingModule целиком собрался в
    // Nest DI (тот же полный набор overrideProvider, что
    // balance-transactions.e2e.spec.ts).
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
        findById: () => Promise.resolve(null),
        update: () => Promise.resolve(),
    };
    const fakeAccountingPeriodRepo: AccountingPeriodRepositoryPort = {
        findByDirectionAndPeriod: () => Promise.resolve(null),
        save: () => Promise.resolve(),
    };
    const fakeAccountingPeriodSnapshot: AccountingPeriodSnapshotPort = {
        saveAll: () => Promise.resolve(),
        findByKey: () => Promise.resolve(null),
        findManyByKey: () => Promise.resolve(new Map()),
        deleteByDirectionAndPeriod: () => Promise.resolve(),
    };
    const fakeAccountingCalculationCache: AccountingCalculationCachePort = {
        find: () => Promise.resolve(null),
        upsert: () => Promise.resolve(),
        deleteByDirectionAndPeriod: () => Promise.resolve(),
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
    const fakeServiceCalculationData: ServiceCalculationDataPort = {
        findEmployeeIdentities: () => Promise.resolve([]),
        findServiceCompletedItems: () => Promise.resolve([]),
        findHoursWorked: () => Promise.resolve({ fact: 8, prognose: 8 }),
        findOrderPayedItems: () => Promise.resolve([]),
        findEmployeeDepartmentId: () => Promise.resolve(null),
        findEmployeesInDepartment: () => Promise.resolve([]),
        findEmployeeIdentitiesForEmployees: () => Promise.resolve(new Map()),
        findHoursWorkedForEmployees: () => Promise.resolve(new Map()),
    };
    const fakeUnitOfWork: UnitOfWorkPort = { run: (work) => work() };
    const fakeDatabaseService = {} as unknown as DatabaseService;
    const fakeErpCashDocumentPort: ErpCashDocumentPort = {
        create: (params) =>
            Promise.resolve({ externalId: `erp-${params.transactionId}` }),
        delete: () => Promise.resolve(),
        findByKey: () => Promise.resolve(null),
    };

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
        const moduleRef = await Test.createTestingModule({
            imports: [
                EventEmitterModule.forRoot(),
                FakeInfrastructureModule,
                AccountingModule,
                EmployeeBalanceModule,
            ],
        })
            .overrideProvider(MOTIVATION_SCHEMA_REPOSITORY)
            .useValue(fakeMotivationSchemaRepo)
            .overrideProvider(SALARY_RULE_REPOSITORY)
            .useValue(fakeSalaryRuleRepo)
            .overrideProvider(ACCOUNTING_PERIOD_REPOSITORY)
            .useValue(fakeAccountingPeriodRepo)
            .overrideProvider(ACCOUNTING_PERIOD_SNAPSHOT)
            .useValue(fakeAccountingPeriodSnapshot)
            .overrideProvider(ACCOUNTING_CALCULATION_CACHE)
            .useValue(fakeAccountingCalculationCache)
            .overrideProvider(SALARY_ACCRUAL_REPOSITORY)
            .useValue(new InMemorySalaryAccrualRepository())
            .overrideProvider(BALANCE_TRANSACTION_REPOSITORY)
            .useValue(transactionRepo)
            .overrideProvider(ERP_PERIOD_SYNC)
            .useValue({ syncPeriod: () => Promise.resolve() })
            .overrideProvider(EMPLOYEE_DISMISSAL)
            .useValue(fakeEmployeeDismissal)
            .overrideProvider(DOMAIN_SYNC_STATUS)
            .useValue(fakeDomainSyncStatus)
            .overrideProvider(SALES_PLAN_REPOSITORY)
            .useValue(fakeSalesPlanRepo)
            .overrideProvider(SERVICE_CALCULATION_DATA)
            .useValue(fakeServiceCalculationData)
            .overrideProvider(DIRECTORY_REPOSITORY)
            .useValue(fakeDirectoryRepo)
            .overrideProvider(SERVICE_ERP_CASH_DOCUMENT_PORT)
            .useValue(fakeErpCashDocumentPort)
            .overrideProvider(SHOP_ERP_CASH_DOCUMENT_PORT)
            .useValue(fakeErpCashDocumentPort)
            .overrideProvider(PAYOUT_CASHBOX_RECORD_REPOSITORY)
            .useValue(new InMemoryPayoutCashboxRecordRepository())
            .compile();

        app = moduleRef.createNestApplication();
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(req, res, next),
        );
        app.useGlobalPipes(new ZodValidationPipe());
        app.useGlobalFilters(new DomainExceptionFilter());
        await app.init();

        // Лента до всех сценариев: 42 — приход-приход (последнее движение
        // позже), 43 — расход (уволен, остаётся в списке с долгом), 44 —
        // без движений (остаток 0, дата последнего движения — null).
        await transactionRepo.insertMany([
            adjustment(42, 5000, new Date('2026-07-01T09:00:00.000Z')),
            adjustment(42, -1000, new Date('2026-07-15T09:00:00.000Z')),
            adjustment(43, -2000, new Date('2026-07-05T09:00:00.000Z')),
        ]);
    });

    afterAll(async () => {
        await app.close();
    });

    function adjustment(employeeId: number, amount: number, occurredAt: Date) {
        return withRequestContext(() =>
            BalanceTransaction.createManual({
                employeeId,
                direction: 'service',
                type: 'ADJUSTMENT',
                amount,
                createdBy: 7,
                occurredAt,
                comment: 'e2e фикстура',
            }),
        );
    }

    it('без departmentId — сотрудники всех отделов с отделом/должностью/датой последнего движения/остатком', async () => {
        const response = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/summary/2026-07')
                .expect(200)
        ).body as BalanceSummaryResponse;

        expect(response.period).toBe('2026-07');
        expect(response.departmentId).toBeNull();
        expect(response.employees.map((row) => row.employeeId).sort()).toEqual([
            42, 43, 44,
        ]);

        const ivan = response.employees.find((row) => row.employeeId === 42);
        expect(ivan).toMatchObject({
            employeeName: 'Иван Петров',
            departmentId: 5,
            departmentName: 'Сервис',
            position: 'Инженер',
            isDismissed: false,
            balance: 4000,
        });
        expect(new Date(ivan!.lastMovementAt as unknown as string)).toEqual(
            new Date('2026-07-15T09:00:00.000Z'),
        );

        const anna = response.employees.find((row) => row.employeeId === 44);
        expect(anna).toMatchObject({
            employeeName: 'Анна Кузнецова',
            departmentId: 6,
            departmentName: 'Магазин',
            position: 'Продавец',
            balance: 0,
            lastMovementAt: null,
        });
    });

    it('с departmentId — только сотрудники этого отдела, KPI считаются по суженной выборке', async () => {
        const response = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/summary/2026-07?departmentId=5')
                .expect(200)
        ).body as BalanceSummaryResponse;

        expect(response.departmentId).toBe(5);
        expect(response.employees.map((row) => row.employeeId).sort()).toEqual([
            42, 43,
        ]);
        // Сотрудник 44 (отдел 6) не входит ни в список, ни в KPI отдела 5.
        expect(response.totals.balance).toBe(4000 - 2000);
    });

    it('search — регистронезависимая подстрока по имени, в рамках уже выбранного отдела', async () => {
        const allDepartments = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/summary/2026-07?search=КУЗНЕЦ')
                .expect(200)
        ).body as BalanceSummaryResponse;
        expect(allDepartments.employees.map((row) => row.employeeId)).toEqual([
            44,
        ]);

        const withinOtherDepartment = (
            await request(app.getHttpServer())
                .get(
                    '/v1/accounting/balance/summary/2026-07?departmentId=5&search=кузнец',
                )
                .expect(200)
        ).body as BalanceSummaryResponse;
        expect(withinOtherDepartment.employees).toEqual([]);
    });

    it('KPI: общий остаток, «к выплате» (положительные) и «долг» (отрицательные) по всей компании', async () => {
        const response = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/summary/2026-07')
                .expect(200)
        ).body as BalanceSummaryResponse;

        expect(response.totals).toEqual({
            balance: 4000 - 2000 + 0,
            toPay: { amount: 4000, count: 1 },
            debt: { amount: -2000, count: 1 },
        });
    });

    it('уволенный сотрудник (43) с ненулевым балансом остаётся в списке с isDismissed: true', async () => {
        const response = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/summary/2026-07?departmentId=5')
                .expect(200)
        ).body as BalanceSummaryResponse;

        const petr = response.employees.find((row) => row.employeeId === 43);
        expect(petr).toMatchObject({
            employeeName: 'Пётр Сидоров',
            isDismissed: true,
            balance: -2000,
        });
    });
});
