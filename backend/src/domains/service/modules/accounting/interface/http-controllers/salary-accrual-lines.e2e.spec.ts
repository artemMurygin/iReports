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
    EmployeeBalanceResponse,
    SalaryAccrualListResponse,
    SalaryAccrualResponse,
} from 'ireports-contracts';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { AccountingModule } from '@/domains/service/modules/accounting/accounting.module';
import { EmployeeBalanceModule } from '@/modules/employee-balance/employee-balance.module';
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
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { InMemoryBalanceTransactionRepository } from '@/modules/employee-balance/infrastructure/repositories/in-memory-balance-transaction.repository';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Сквозной путь PRD 2 docs/payroll-closing-and-accrual (Фаза 6, tracer
// bullet): close → accrue → balance → unaccrue → reopen через реальные
// HTTP-контроллеры, CommandBus, хендлеры и сущности AccountingModule, с
// in-memory заменой только границы БД (тот же приём, что и в
// salary-accruals.e2e.spec.ts). Плюс сквозная проверка «reopen с
// проведённой строкой → 409» — теперь через реальное проведение, а не
// тестовый рычаг markStatus.
describe('Проведение строк: close → accrue → balance → unaccrue → reopen (e2e)', () => {
    let app: INestApplication<Server>;
    const schemas = new Map<number, MotivationSchema>();
    const periods = new Map<string, AccountingPeriod>();
    const snapshots = new Map<string, AccountingPeriodSnapshotRow[]>();
    const accrualRepo = new InMemorySalaryAccrualRepository();
    const transactionRepo = new InMemoryBalanceTransactionRepository();
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
        findDismissedEmployeeIds: () => Promise.resolve(new Set<number>()),
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
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        updateEmployeesOrder: () => Promise.resolve(),
        findServiceAccountEmployeeIds: () => Promise.resolve(new Set<number>()),
        setServiceAccount: () => Promise.resolve(null),
        findEmployees: () =>
            Promise.resolve([
                {
                    id: 42,
                    firstName: 'Иван',
                    lastName: 'Петров',
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
        const schema = withRequestContext(() =>
            MotivationSchema.create({
                targetType: 'Employee',
                targetId: 42,
                name: 'Оклад инженера',
                rules: [
                    PayPerHoursEntity.create({
                        type: 'PayPerHour',
                        name: 'Почасовая ставка',
                        targetRole: 'ENGINEER',
                        config: { price: 250 },
                    }),
                ],
            }),
        );
        schemas.set(42, schema);

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
            .useValue(accrualRepo)
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

    it('close → accrue → balance → unaccrue → reopen', async () => {
        // Закрытие месяца рождает документ DRAFT.
        await request(app.getHttpServer())
            .post('/v1/service/accounting/period/2026-07/close')
            .send({ closedBy: 1 })
            .expect(201);

        const list = (
            await request(app.getHttpServer())
                .get('/v1/service/accounting/salary_accruals?period=2026-07')
                .expect(200)
        ).body as SalaryAccrualListResponse;
        const accrualId = list.items[0].id;
        expect(list.items[0]).toMatchObject({
            status: 'DRAFT',
            accruedLinesCount: 0,
            linesCount: 1,
        });

        const card = (
            await request(app.getHttpServer())
                .get(`/v1/service/accounting/salary_accruals/${accrualId}`)
                .expect(200)
        ).body as SalaryAccrualResponse;
        const lineId = card.lines[0].id;

        // До проведения баланс пуст.
        const emptyBalance = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/employee/42')
                .expect(200)
        ).body as EmployeeBalanceResponse;
        expect(emptyBalance).toMatchObject({
            employeeId: 42,
            balance: 0,
            transactions: [],
        });

        // Проведение строки — на балансе движение SALARY_ACCRUAL.
        const accrued = (
            await request(app.getHttpServer())
                .post(
                    `/v1/service/accounting/salary_accruals/${accrualId}/lines/${lineId}/accrue`,
                )
                .send({ accruedBy: 7 })
                .expect(201)
        ).body as SalaryAccrualResponse;
        expect(accrued.status).toBe('ACCRUED');
        expect(accrued.accruedLinesCount).toBe(1);
        expect(accrued.lines[0].status).toBe('ACCRUED');

        const balance = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/employee/42')
                .expect(200)
        ).body as EmployeeBalanceResponse;
        expect(balance.balance).toBe(2000);
        expect(balance.selectionTotal).toBe(2000);
        expect(balance.transactions).toHaveLength(1);
        expect(balance.transactions[0]).toMatchObject({
            type: 'SALARY_ACCRUAL',
            amount: 2000,
            employeeId: 42,
            direction: 'service',
            period: '2026-07',
            accrualId,
            lineId,
            createdBy: 7,
        });
        // Лента не раскрывается (Фаза 8b): детализация начисления живёт в
        // документе, движение ведёт на него ссылкой accrualId (проверена
        // выше), поля accrualLine в ответе нет.
        expect(balance.transactions[0]).not.toHaveProperty('accrualLine');

        // Повторное проведение той же строки → 409, второго движения нет.
        await request(app.getHttpServer())
            .post(
                `/v1/service/accounting/salary_accruals/${accrualId}/lines/${lineId}/accrue`,
            )
            .send({ accruedBy: 7 })
            .expect(409);
        expect(transactionRepo.store.size).toBe(1);

        // Reopen с проведённой строкой → 409 с перечнем (сквозная проверка
        // блокировки из Фазы 1 на реально проведённой строке).
        const reopenBlocked = await request(app.getHttpServer())
            .post('/v1/service/accounting/period/2026-07/reopen')
            .send({ confirm: true })
            .expect(409);
        expect(reopenBlocked.body).toMatchObject({
            metadata: {
                accruals: [
                    { id: accrualId, employeeId: 42, status: 'ACCRUED' },
                ],
            },
        });

        // Отмена начисления удаляет движение, остаток снова 0.
        const unaccrued = (
            await request(app.getHttpServer())
                .post(
                    `/v1/service/accounting/salary_accruals/${accrualId}/lines/${lineId}/unaccrue`,
                )
                .expect(201)
        ).body as SalaryAccrualResponse;
        expect(unaccrued.status).toBe('DRAFT');
        expect(unaccrued.lines[0].status).toBe('DRAFT');

        const balanceAfter = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/employee/42')
                .expect(200)
        ).body as EmployeeBalanceResponse;
        expect(balanceAfter.balance).toBe(0);
        expect(balanceAfter.transactions).toEqual([]);

        // После отмены документ снова DRAFT — reopen проходит.
        const reopen = await request(app.getHttpServer())
            .post('/v1/service/accounting/period/2026-07/reopen')
            .send({ confirm: true })
            .expect(201);
        expect((reopen.body as AccountingPeriodResponse).status).toBe('OPEN');
        expect(accrualRepo.store.size).toBe(0);
    });

    it('корректировка по HTTP: PATCH до проведения, 400 без комментария, при проведении два движения', async () => {
        await request(app.getHttpServer())
            .post('/v1/service/accounting/period/2026-06/close')
            .send({ closedBy: 1 })
            .expect(201);
        const list = (
            await request(app.getHttpServer())
                .get('/v1/service/accounting/salary_accruals?period=2026-06')
                .expect(200)
        ).body as SalaryAccrualListResponse;
        const accrualId = list.items[0].id;
        const card = (
            await request(app.getHttpServer())
                .get(`/v1/service/accounting/salary_accruals/${accrualId}`)
                .expect(200)
        ).body as SalaryAccrualResponse;
        const lineId = card.lines[0].id;

        // Без комментария — 400 на границе HTTP (zod), домен не тронут.
        await request(app.getHttpServer())
            .patch(
                `/v1/service/accounting/salary_accruals/${accrualId}/lines/${lineId}`,
            )
            .send({ amount: 1500, comment: '', adjustedBy: 7 })
            .expect(400);

        const adjusted = (
            await request(app.getHttpServer())
                .patch(
                    `/v1/service/accounting/salary_accruals/${accrualId}/lines/${lineId}`,
                )
                .send({
                    amount: 1500,
                    comment: 'Простой оборудования',
                    adjustedBy: 7,
                })
                .expect(200)
        ).body as SalaryAccrualResponse;
        expect(adjusted.lines[0]).toMatchObject({
            amount: 1500,
            originalAmount: 2000,
            adjustmentComment: 'Простой оборудования',
        });

        // Проведение скорректированной строки — два движения, сумма = новая.
        await request(app.getHttpServer())
            .post(
                `/v1/service/accounting/salary_accruals/${accrualId}/lines/${lineId}/accrue`,
            )
            .send({ accruedBy: 7 })
            .expect(201);

        const balance = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/employee/42')
                .expect(200)
        ).body as EmployeeBalanceResponse;
        expect(balance.transactions).toHaveLength(2);
        expect(balance.balance).toBe(1500);
        const adjustment = balance.transactions.find(
            (transaction) => transaction.type === 'ACCRUAL_ADJUSTMENT',
        );
        expect(adjustment).toMatchObject({
            amount: -500,
            comment: 'Простой оборудования',
            lineId,
        });

        // Корректировка проведённой строки → 409.
        await request(app.getHttpServer())
            .patch(
                `/v1/service/accounting/salary_accruals/${accrualId}/lines/${lineId}`,
            )
            .send({ amount: 1000, comment: 'Поздно', adjustedBy: 7 })
            .expect(409);

        // Фильтр ленты по типам.
        const filtered = (
            await request(app.getHttpServer())
                .get(
                    '/v1/accounting/balance/employee/42?types=ACCRUAL_ADJUSTMENT',
                )
                .expect(200)
        ).body as EmployeeBalanceResponse;
        expect(filtered.transactions).toHaveLength(1);
        expect(filtered.selectionTotal).toBe(-500);
        expect(filtered.balance).toBe(1500);
    });
});
