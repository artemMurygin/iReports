import type { Server } from 'http';
import { ERP_PERIOD_SYNC } from '@/domains/service/modules/accounting/application/ports/erp-period-sync.port';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type {
    AccruePeriodSalaryAccrualsResponse,
    AccrueSalaryAccrualDocumentResponse,
    BalanceTransaction,
    DepartmentBalancesResponse,
    EmployeeBalanceResponse,
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
import { BALANCE_TRANSACTION_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/balance-transaction.port';
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
import { InMemoryBalanceTransactionRepository } from '@/domains/service/modules/accounting/testing/in-memory-balance-transaction.repository';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Сквозные сценарии Фаз 7/8b PRD 2 (docs/payroll-closing-and-accrual):
// массовое проведение по документу и месяцу, ручные движения на ОБЩЕМ
// балансе сотрудника (каждый тип доступен по HTTP; штраф без комментария —
// 400), удаление ошибочного ручного движения (DELETE) и запреты удаления,
// движение задним числом в закрытом месяце без изменения снапшота и
// документов, сводка общих балансов по отделу. Реальные контроллеры,
// CommandBus и сущности AccountingModule, in-memory замена только границы
// БД — тот же приём, что salary-accrual-lines.e2e.spec.ts.
describe('Фазы 7/8b: массовое проведение, ручные движения, удаление, сводка отдела (e2e)', () => {
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
        findHoursWorked: () => Promise.resolve(8),
        findOrderPayedItems: () => Promise.resolve([]),
        findConfirmedTaskCompletions: () => Promise.resolve([]),
        findEmployeeDepartmentId: () => Promise.resolve(null),
        findEmployeesInDepartment: () => Promise.resolve([]),
        findEmployeeIdentitiesForEmployees: () => Promise.resolve(new Map()),
        findHoursWorkedForEmployees: () => Promise.resolve(new Map()),
    };
    const employees = [
        { id: 42, firstName: 'Иван', lastName: 'Петров', departmentId: 5 },
        { id: 43, firstName: 'Пётр', lastName: 'Сидоров', departmentId: 5 },
    ];
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        // Сводка отдела зовёт findEmployees(departmentId) — текущий состав
        // отдела Bitrix24 на момент запроса.
        findEmployees: (departmentId) =>
            Promise.resolve(
                employees.filter(
                    (employee) =>
                        departmentId === undefined ||
                        employee.departmentId === departmentId,
                ),
            ),
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
        for (const employee of employees) {
            const schema = withRequestContext(() =>
                MotivationSchema.create({
                    targetType: 'Employee',
                    targetId: employee.id,
                    name: `Оклад ${employee.firstName}`,
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
            schemas.set(employee.id, schema);
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

    it('массовое проведение: «Начислить всё» по документу и «Начислить все документы месяца»', async () => {
        await request(app.getHttpServer())
            .post('/v1/service/accounting/period/2026-07/close')
            .send({ closedBy: 1 })
            .expect(201);

        const list = (
            await request(app.getHttpServer())
                .get('/v1/service/accounting/salary_accruals?period=2026-07')
                .expect(200)
        ).body as SalaryAccrualListResponse;
        expect(list.items).toHaveLength(2);

        // «Начислить всё» по документу первого сотрудника.
        const first = list.items.find((item) => item.employeeId === 42)!;
        const documentResult = (
            await request(app.getHttpServer())
                .post(
                    `/v1/service/accounting/salary_accruals/${first.id}/accrue`,
                )
                .send({ accruedBy: 7 })
                .expect(201)
        ).body as AccrueSalaryAccrualDocumentResponse;
        expect(documentResult.failures).toEqual([]);
        expect(documentResult.accrual.status).toBe('ACCRUED');
        expect(documentResult.accrual.accruedLinesCount).toBe(
            documentResult.accrual.linesCount,
        );

        // «Начислить все документы месяца» доводит оставшийся документ.
        const periodResult = (
            await request(app.getHttpServer())
                .post(
                    '/v1/service/accounting/salary_accruals/accrue?period=2026-07',
                )
                .send({ accruedBy: 7 })
                .expect(201)
        ).body as AccruePeriodSalaryAccrualsResponse;
        expect(periodResult).toMatchObject({
            direction: 'service',
            period: '2026-07',
            documentsCount: 2,
            accruedDocumentsCount: 2,
            accruedLinesCount: 1,
            failures: [],
        });
        expect(periodResult.accruedAmount).toBeGreaterThan(0);

        // Повторный массовый запуск идемпотентен: движений не прибавилось.
        const repeated = (
            await request(app.getHttpServer())
                .post(
                    '/v1/service/accounting/salary_accruals/accrue?period=2026-07',
                )
                .send({ accruedBy: 7 })
                .expect(201)
        ).body as AccruePeriodSalaryAccrualsResponse;
        expect(repeated.accruedLinesCount).toBe(0);
        expect(repeated.accruedDocumentsCount).toBe(2);
    });

    it('ручные движения: каждый тип по HTTP, штраф без комментария → 400, минус — штатно; движение задним числом не меняет снапшот и документы', async () => {
        const before = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/employee/42')
                .expect(200)
        ).body as EmployeeBalanceResponse;

        // Каждый тип ручного движения.
        const cases: {
            type: string;
            amount: number;
            comment?: string;
            expected: number;
        }[] = [
            { type: 'ADVANCE', amount: 5000, expected: -5000 },
            { type: 'EXTRA_ADVANCE', amount: 2000, expected: -2000 },
            { type: 'BONUS', amount: 3000, expected: 3000 },
            { type: 'SICK_LEAVE', amount: 1500, expected: 1500 },
            { type: 'VACATION_PAY', amount: 2500, expected: 2500 },
            {
                type: 'PENALTY',
                amount: 1000,
                comment: 'Опоздание',
                expected: -1000,
            },
            {
                type: 'ADJUSTMENT',
                amount: -700,
                comment: 'Переплата за июль',
                expected: -700,
            },
        ];
        for (const item of cases) {
            const created = (
                await request(app.getHttpServer())
                    .post('/v1/accounting/balance/employee/42/transactions')
                    .send({
                        direction: 'service',
                        type: item.type,
                        amount: item.amount,
                        comment: item.comment,
                        createdBy: 7,
                    })
                    .expect(201)
            ).body as BalanceTransaction;
            expect(created).toMatchObject({
                type: item.type,
                amount: item.expected,
                employeeId: 42,
                direction: 'service',
                erpSyncRequired: false,
            });
        }

        // Штраф и корректировка без комментария — 400 на границе HTTP.
        await request(app.getHttpServer())
            .post('/v1/accounting/balance/employee/42/transactions')
            .send({
                direction: 'service',
                type: 'PENALTY',
                amount: 500,
                createdBy: 7,
            })
            .expect(400);
        await request(app.getHttpServer())
            .post('/v1/accounting/balance/employee/42/transactions')
            .send({
                direction: 'service',
                type: 'ADJUSTMENT',
                amount: 500,
                createdBy: 7,
            })
            .expect(400);

        const after = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/employee/42')
                .expect(200)
        ).body as EmployeeBalanceResponse;
        // -5000 -2000 +3000 +1500 +2500 -1000 -700 = -1700 к прежнему
        // остатку: авансы больше начисленного — штатный минус без лимитов.
        expect(after.balance).toBe(before.balance - 1700);

        // Движение задним числом внутри закрытого 2026-07: снапшот и
        // документы начисления не меняются.
        const snapshotBefore = JSON.stringify(snapshots.get('service:2026-07'));
        const accrualsBefore = (
            await request(app.getHttpServer())
                .get('/v1/service/accounting/salary_accruals?period=2026-07')
                .expect(200)
        ).body as SalaryAccrualListResponse;

        const backdated = (
            await request(app.getHttpServer())
                .post('/v1/accounting/balance/employee/42/transactions')
                .send({
                    direction: 'service',
                    type: 'ADVANCE',
                    amount: 800,
                    occurredAt: '2026-07-15T00:00:00.000Z',
                    period: '2026-07',
                    createdBy: 7,
                    erpSyncRequired: true,
                })
                .expect(201)
        ).body as BalanceTransaction;
        expect(backdated.occurredAt).toBe('2026-07-15T00:00:00.000Z');
        // erpSyncRequired только хранится и отдаётся — в ERP ничего не ушло.
        expect(backdated.erpSyncRequired).toBe(true);
        // В ленте видно, что запись создана позже даты движения.
        expect(new Date(backdated.createdAt).getTime()).toBeGreaterThan(
            new Date(backdated.occurredAt).getTime(),
        );

        expect(JSON.stringify(snapshots.get('service:2026-07'))).toBe(
            snapshotBefore,
        );
        const accrualsAfter = (
            await request(app.getHttpServer())
                .get('/v1/service/accounting/salary_accruals?period=2026-07')
                .expect(200)
        ).body as SalaryAccrualListResponse;
        expect(accrualsAfter).toEqual(accrualsBefore);
    });

    it('общий баланс: движения обоих направлений — одна лента и один остаток', async () => {
        const before = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/employee/43')
                .expect(200)
        ).body as EmployeeBalanceResponse;

        // Ручное движение происхождения shop через тот же общий эндпоинт —
        // остаток тот же самый, direction лишь атрибут движения.
        const shopBonus = (
            await request(app.getHttpServer())
                .post('/v1/accounting/balance/employee/43/transactions')
                .send({
                    direction: 'shop',
                    type: 'BONUS',
                    amount: 1200,
                    createdBy: 7,
                })
                .expect(201)
        ).body as BalanceTransaction;
        expect(shopBonus.direction).toBe('shop');

        const after = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/employee/43')
                .expect(200)
        ).body as EmployeeBalanceResponse;
        expect(after.balance).toBe(before.balance + 1200);
        expect(
            after.transactions.some(
                (transaction) => transaction.id === shopBonus.id,
            ),
        ).toBe(true);
    });

    it('удаление: ручное движение удаляется, остаток пересчитан; начисление и движение с ERP — 409', async () => {
        const advance = (
            await request(app.getHttpServer())
                .post('/v1/accounting/balance/employee/43/transactions')
                .send({
                    direction: 'service',
                    type: 'ADVANCE',
                    amount: 4000,
                    createdBy: 7,
                })
                .expect(201)
        ).body as BalanceTransaction;

        const balanceBefore = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/employee/43')
                .expect(200)
        ).body as EmployeeBalanceResponse;

        // Ошибочное ручное движение удаляется — запись исчезает из ленты.
        await request(app.getHttpServer())
            .delete(`/v1/accounting/balance/transactions/${advance.id}`)
            .expect(204);

        // Повторное удаление — 404: записи больше нет.
        await request(app.getHttpServer())
            .delete(`/v1/accounting/balance/transactions/${advance.id}`)
            .expect(404);

        const balanceAfter = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/employee/43')
                .expect(200)
        ).body as EmployeeBalanceResponse;
        expect(balanceAfter.balance).toBe(balanceBefore.balance + 4000);
        expect(
            balanceAfter.transactions.find(
                (transaction) => transaction.id === advance.id,
            ),
        ).toBeUndefined();

        // Движение начисления прямым DELETE не удаляется — только
        // «Отменить начисление» на строке документа.
        const accrualTransaction = balanceAfter.transactions.find(
            (transaction) => transaction.type === 'SALARY_ACCRUAL',
        );
        expect(accrualTransaction).toBeDefined();
        await request(app.getHttpServer())
            .delete(
                `/v1/accounting/balance/transactions/${accrualTransaction!.id}`,
            )
            .expect(409);

        // Движение с документом ERP (erpSyncRequired) — 409: удаляется
        // вместе с документом ERP (PRD 3).
        const erpAdvance = (
            await request(app.getHttpServer())
                .post('/v1/accounting/balance/employee/43/transactions')
                .send({
                    direction: 'service',
                    type: 'ADVANCE',
                    amount: 300,
                    createdBy: 7,
                    erpSyncRequired: true,
                })
                .expect(201)
        ).body as BalanceTransaction;
        await request(app.getHttpServer())
            .delete(`/v1/accounting/balance/transactions/${erpAdvance.id}`)
            .expect(409);
    });

    it('сводка по отделу: остаток/начислено/авансы/ручные по сотрудникам текущего отдела, итог = сумма сотрудников', async () => {
        const summary = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/department/5/2026-07')
                .expect(200)
        ).body as DepartmentBalancesResponse;

        expect(summary.departmentId).toBe(5);
        expect(summary.employees).toHaveLength(2);
        expect(summary.employees.map((row) => row.employeeId).sort()).toEqual([
            42, 43,
        ]);

        // Балансы по сводке совпадают с ответом баланса сотрудника.
        for (const row of summary.employees) {
            const balance = (
                await request(app.getHttpServer())
                    .get(`/v1/accounting/balance/employee/${row.employeeId}`)
                    .expect(200)
            ).body as EmployeeBalanceResponse;
            expect(row.balance).toBe(balance.balance);
            expect(row.accrualStatus).toBe('ACCRUED');
        }

        // Итог по отделу — сумма сотрудников (критерий PRD 2).
        expect(summary.totals).toEqual({
            balance: summary.employees.reduce(
                (sum, row) => sum + row.balance,
                0,
            ),
            accrued: summary.employees.reduce(
                (sum, row) => sum + row.accrued,
                0,
            ),
            advances: summary.employees.reduce(
                (sum, row) => sum + row.advances,
                0,
            ),
            manual: summary.employees.reduce((sum, row) => sum + row.manual, 0),
        });
        // Начислено за месяц — сумма проведённых документов обоих
        // сотрудников (движения начисления периода 2026-07).
        const list = (
            await request(app.getHttpServer())
                .get('/v1/service/accounting/salary_accruals?period=2026-07')
                .expect(200)
        ).body as SalaryAccrualListResponse;
        expect(summary.totals.accrued).toBe(list.total);
    });

    it('карточка документа после массового проведения отдаёт строки в ACCRUED (регресс чтения)', async () => {
        const list = (
            await request(app.getHttpServer())
                .get('/v1/service/accounting/salary_accruals?period=2026-07')
                .expect(200)
        ).body as SalaryAccrualListResponse;
        const card = (
            await request(app.getHttpServer())
                .get(
                    `/v1/service/accounting/salary_accruals/${list.items[0].id}`,
                )
                .expect(200)
        ).body as SalaryAccrualResponse;
        expect(card.status).toBe('ACCRUED');
        expect(card.lines.every((line) => line.status === 'ACCRUED')).toBe(
            true,
        );
    });
});
