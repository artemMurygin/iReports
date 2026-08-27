import type { Server } from 'http';
import { ERP_PERIOD_SYNC } from '@/domains/service/modules/accounting/application/ports/erp-period-sync.port';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type {
    AccountingPeriodResponse,
    EmployeeSalaryReportResponse,
    SalaryAccrualListResponse,
    SalaryAccrualResponse,
} from 'ireports-contracts';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { AccountingModule } from '@/domains/service/modules/accounting/accounting.module';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
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
import { SERVICE_CALCULATION_DATA } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/testing/in-memory-salary-accrual.repository';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Сквозной путь PRD 1 docs/payroll-closing-and-accrual (Фаза 1, tracer
// bullet): close → list → get → reopen через реальные HTTP-контроллеры,
// CommandBus, хендлеры и сущности AccountingModule, с in-memory заменой
// только границы БД (тот же приём и те же оговорки, что и в
// get-employee-salary-report.e2e.spec.ts).
describe('Документы начисления: close → salary_accruals → reopen (e2e)', () => {
    let app: INestApplication<Server>;
    const schemas = new Map<number, MotivationSchema>();
    const periods = new Map<string, AccountingPeriod>();
    const snapshots = new Map<string, AccountingPeriodSnapshotRow[]>();
    const accrualRepo = new InMemorySalaryAccrualRepository();
    const periodKey = (direction: string, period: string) =>
        `${direction}:${period}`;

    const fakeMotivationSchemaRepo: MotivationSchemaRepositoryPort = {
        insert: () => Promise.resolve(),
        findByEmployee: (employeeId) =>
            Promise.resolve(schemas.get(employeeId) ?? null),
        findByEmployees: () => Promise.resolve([]),
        findAllEmployeeTargets: () => Promise.resolve([...schemas.values()]),
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
        findByKey: (direction, period, employeeId) =>
            Promise.resolve(
                snapshots
                    .get(periodKey(direction, period))
                    ?.find((row) => row.employeeId === employeeId) ?? null,
            ),
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
        findDismissedEmployeeIds: (ids) =>
            Promise.resolve(new Set(ids.filter((id) => id === 43))),
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
        findConfirmedTaskCompletions: () => Promise.resolve([]),
        findEmployeeDepartmentId: () => Promise.resolve(null),
        findEmployeesInDepartment: () => Promise.resolve([]),
        findEmployeeIdentitiesForEmployees: () => Promise.resolve(new Map()),
        findHoursWorkedForEmployees: () => Promise.resolve(new Map()),
    };
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        findEmployees: () =>
            Promise.resolve([
                {
                    id: 42,
                    firstName: 'Иван',
                    lastName: 'Петров',
                    departmentId: 5,
                },
                {
                    id: 43,
                    firstName: 'Пётр',
                    lastName: 'Уволенный',
                    departmentId: 5,
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
        for (const [employeeId, price] of [
            [42, 250],
            [43, 100],
        ] as const) {
            const schema = withRequestContext(() =>
                MotivationSchema.create({
                    targetType: 'Employee',
                    targetId: employeeId,
                    name: 'Оклад инженера',
                    rules: [
                        PayPerHoursEntity.create({
                            type: 'PayPerHour',
                            name: 'Почасовая ставка',
                            targetRole: 'ENGINEER',
                            config: { price },
                        }),
                    ],
                }),
            );
            schemas.set(employeeId, schema);
        }

        const moduleRef = await Test.createTestingModule({
            imports: [
                EventEmitterModule.forRoot(),
                FakeInfrastructureModule,
                AccountingModule,
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
            .useValue(accrualRepo)
            // Неявная синхронизация ERP внутри закрытия (Фаза 2 PRD 1) —
            // в e2e заменена no-op: реальная ERP недоступна.
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

    it('до закрытия список начислений за период пуст', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/service/accounting/salary_accruals?period=2026-07')
            .expect(200);
        expect(response.body as SalaryAccrualListResponse).toEqual({
            direction: 'service',
            period: '2026-07',
            items: [],
            total: 0,
        });
    });

    it('close → документы DRAFT в списке и в карточке, статус в отчёте сотрудника → reopen удаляет документы', async () => {
        const closeResponse = await request(app.getHttpServer())
            .post('/v1/service/accounting/period/2026-07/close')
            .send({ closedBy: 1 })
            .expect(201);
        expect((closeResponse.body as AccountingPeriodResponse).status).toBe(
            'CLOSED',
        );

        const listResponse = await request(app.getHttpServer())
            .get('/v1/service/accounting/salary_accruals?period=2026-07')
            .expect(200);
        const list = listResponse.body as SalaryAccrualListResponse;
        expect(list.direction).toBe('service');
        expect(list.period).toBe('2026-07');
        expect(list.total).toBe(2000 + 800);
        expect(list.items).toHaveLength(2);
        expect(list.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    employeeId: 42,
                    employeeName: 'Иван Петров',
                    departmentId: 5,
                    status: 'DRAFT',
                    isDismissed: false,
                    total: 2000,
                    linesCount: 1,
                }),
                expect.objectContaining({
                    employeeId: 43,
                    employeeName: 'Пётр Уволенный',
                    status: 'DRAFT',
                    isDismissed: true,
                    total: 800,
                    linesCount: 1,
                }),
            ]),
        );

        const accrual42 = list.items.find((item) => item.employeeId === 42);
        const cardResponse = await request(app.getHttpServer())
            .get(`/v1/service/accounting/salary_accruals/${accrual42?.id}`)
            .expect(200);
        const card = cardResponse.body as SalaryAccrualResponse;
        expect(card).toMatchObject({
            id: accrual42?.id,
            employeeId: 42,
            status: 'DRAFT',
            total: 2000,
        });
        expect(card.lines).toEqual([
            expect.objectContaining({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                quantity: 8,
                rate: 250,
                originalAmount: 2000,
                amount: 2000,
                status: 'DRAFT',
                sources: [],
            }),
        ]);

        // Статус документа в отчёте сотрудника за закрытый период.
        const reportResponse = await request(app.getHttpServer())
            .get('/v1/service/accounting/salary_report/employee/42/2026-07')
            .expect(200);
        const report = reportResponse.body as EmployeeSalaryReportResponse;
        expect(report.isClosed).toBe(true);
        expect(report.accrualStatus).toBe('DRAFT');

        // Документа shop под путём service нет.
        await request(app.getHttpServer())
            .get('/v1/service/accounting/salary_accruals/unknown-id')
            .expect(404);

        const reopenResponse = await request(app.getHttpServer())
            .post('/v1/service/accounting/period/2026-07/reopen')
            .send({ confirm: true })
            .expect(201);
        expect((reopenResponse.body as AccountingPeriodResponse).status).toBe(
            'OPEN',
        );

        const afterReopen = await request(app.getHttpServer())
            .get('/v1/service/accounting/salary_accruals?period=2026-07')
            .expect(200);
        expect((afterReopen.body as SalaryAccrualListResponse).items).toEqual(
            [],
        );
        expect(accrualRepo.store.size).toBe(0);
        expect(snapshots.has(periodKey('service', '2026-07'))).toBe(false);
    });

    it('reopen с документом не в DRAFT → 409 с перечнем, документы и снапшот на месте', async () => {
        await request(app.getHttpServer())
            .post('/v1/service/accounting/period/2026-06/close')
            .send({ closedBy: 1 })
            .expect(201);
        const accruals = await accrualRepo.findByDirectionAndPeriod(
            'service',
            '2026-06',
        );
        const accrued = accruals.find((item) => item.employeeId === 43);
        accrualRepo.markStatus(accrued!.id, 'ACCRUED');

        const response = await request(app.getHttpServer())
            .post('/v1/service/accounting/period/2026-06/reopen')
            .send({ confirm: true })
            .expect(409);
        expect(response.body).toMatchObject({
            metadata: {
                accruals: [
                    { id: accrued!.id, employeeId: 43, status: 'ACCRUED' },
                ],
            },
        });

        expect(periods.get(periodKey('service', '2026-06'))?.status).toBe(
            'CLOSED',
        );
        expect(snapshots.has(periodKey('service', '2026-06'))).toBe(true);
        await expect(
            accrualRepo.findByDirectionAndPeriod('service', '2026-06'),
        ).resolves.toHaveLength(2);
    });

    it('список без period → 400', async () => {
        await request(app.getHttpServer())
            .get('/v1/service/accounting/salary_accruals')
            .expect(400);
    });
});
