import type { Server } from 'http';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type {
    AccrueSalaryAccrualDocumentResponse,
    EmployeeBalanceResponse,
    PayoutConfirmationRequired,
    PayoutResponse,
    SalaryAccrualListResponse,
    SalaryAccrualResponse,
} from 'ireports-contracts';
import type { ApiErrorResponse } from '@/shared/exceptions/exeption.api';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { AccountingModule } from '@/domains/service/modules/accounting/accounting.module';
import { EmployeeBalanceModule } from '@/modules/employee-balance/employee-balance.module';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema/salary-rule.port';
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
import { ERP_PERIOD_SYNC } from '@/shared/application/ports/erp-period-sync.port';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { SERVICE_CALCULATION_DATA } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import { DIRECTORY_REPOSITORY } from '@/modules/directory/application/ports/directory.port';
import type { DirectoryRepositoryPort } from '@/modules/directory/application/ports/directory.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { SERVICE_ERP_CASH_DOCUMENT_PORT } from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import type {
    CreateErpCashDocumentParams,
    DeleteErpCashDocumentParams,
    ErpCashDocumentPort,
} from '@/domains/service/modules/accounting/application/ports/erp-cash-document.port';
import { SHOP_ERP_CASH_DOCUMENT_PORT } from '@/domains/shop/modules/accounting/application/ports/cashbox/cashbox-document.port';
import { PAYOUT_CASHBOX_RECORD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/payout-cashbox-record-repository.port';
import { AccountingPeriod } from '@/domains/service/modules/accounting/domain/entities/accounting-period.entity';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { InMemorySalaryAccrualRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/salary-accrual/in-memory-salary-accrual.repository';
import { InMemoryBalanceTransactionRepository } from '@/modules/employee-balance/infrastructure/repositories/in-memory-balance-transaction.repository';
import { InMemoryPayoutCashboxRecordRepository } from '@/domains/service/modules/accounting/infrastructure/repositories/erp-cash/in-memory-payout-cashbox-record.repository';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// PRD 3 (docs/payroll-closing-and-accrual/prd-salary-payout-and-erp-cash-documents.md),
// «Критерии готовности», раздел «Общее»: «e2e-тест пайплайна «закрытие →
// начисление → выплата → удаление выплаты» проходит на тестовой БД с
// замоканной ERP» — один сквозной сценарий на весь путь Фаз 1/6/12 PRD
// 1–3, направление service достаточно (PRD не требует зеркала на shop для
// ЭТОГО критерия — shop-версия пайплайна покрыта своими юнит-тестами
// хендлеров выплаты, см. отчёт Фазы 12). Реальные контроллеры/CommandBus/
// сущности AccountingModule, in-memory замена только границы БД и внешних
// систем (ERP) — тот же приём, что balance-transactions.e2e.spec.ts и
// salary-accrual-lines.e2e.spec.ts.
//
// Фаза 6 docs/employee-settlements-page-redesign: ассерты старой страницы-
// отчёта GET .../payout/:period (шаги «страница выплаты видит сотрудника»
// до/после выплаты) удалены вместе с самим эндпоинтом
// (GetPayoutPageHttpController) — заменён сквозным
// GET /v1/accounting/balance/summary/:period (Фаза 1 того же плана,
// см. get-balance-summary.service.spec.ts). Сценарий создания/удаления
// выплаты (шаги ниже) не тронут — это то самое действие «выплатить», не
// переименованное и не удалённое (PRD, «Технические ограничения»).
describe('Фаза 12 PRD 3: закрытие → начисление → выплата → удаление выплаты (e2e)', () => {
    let app: INestApplication<Server>;
    const schemas = new Map<number, MotivationSchema>();
    const periods = new Map<string, AccountingPeriod>();
    const snapshots = new Map<string, AccountingPeriodSnapshotRow[]>();
    const accrualRepo = new InMemorySalaryAccrualRepository();
    const transactionRepo = new InMemoryBalanceTransactionRepository();
    const payoutCashboxRecordRepo = new InMemoryPayoutCashboxRecordRepository();
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
        findHoursWorked: () => Promise.resolve({ fact: 20, prognose: 20 }),
        findOrderPayedItems: () => Promise.resolve([]),
        findEmployeeDepartmentId: () => Promise.resolve(null),
        findEmployeesInDepartment: () => Promise.resolve([]),
        findEmployeeIdentitiesForEmployees: () => Promise.resolve(new Map()),
        findHoursWorkedForEmployees: () => Promise.resolve(new Map()),
    };
    const employee = {
        id: 42,
        firstName: 'Иван',
        lastName: 'Петров',
        departmentId: 5,
    };
    const fakeDirectoryRepo: DirectoryRepositoryPort = {
        findDepartments: () => Promise.resolve([]),
        updateEmployeesOrder: () => Promise.resolve(),
        findServiceAccountEmployeeIds: () => Promise.resolve(new Set<number>()),
        setServiceAccount: () => Promise.resolve(null),
        findEmployees: () => Promise.resolve([employee]),
    };
    const fakeUnitOfWork: UnitOfWorkPort = { run: (work) => work() };
    const fakeDatabaseService = {} as unknown as DatabaseService;
    // Ограничение безопасности PRD 3 (Фаза 11/12): в тестах не вызывается
    // реальный RemOnline/МойСклад — ERP полностью замокана in-memory
    // фейком, вызовы записываются для проверки «сначала ERP, потом наша БД»
    // и «сначала удаление в ERP, потом движение».
    const erpCreateCalls: CreateErpCashDocumentParams[] = [];
    const erpDeleteCalls: DeleteErpCashDocumentParams[] = [];
    const fakeErpCashDocumentPort: ErpCashDocumentPort = {
        create: (params) => {
            erpCreateCalls.push(params);
            return Promise.resolve({
                externalId: `erp-${params.transactionId}`,
            });
        },
        delete: (params) => {
            erpDeleteCalls.push(params);
            return Promise.resolve();
        },
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
            .overrideProvider(SERVICE_ERP_CASH_DOCUMENT_PORT)
            .useValue(fakeErpCashDocumentPort)
            .overrideProvider(SHOP_ERP_CASH_DOCUMENT_PORT)
            .useValue(fakeErpCashDocumentPort)
            .overrideProvider(PAYOUT_CASHBOX_RECORD_REPOSITORY)
            .useValue(payoutCashboxRecordRepo)
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

    it('закрытие → начисление → выплата → удаление выплаты: остаток и статус документа на каждом шаге', async () => {
        // 1) Закрытие месяца — создаёт документ начисления DRAFT (PRD 1).
        await request(app.getHttpServer())
            .post('/v1/service/accounting/period/2026-07/close')
            .send({ closedBy: 1 })
            .expect(201);

        const list = (
            await request(app.getHttpServer())
                .get('/v1/service/accounting/salary_accruals?period=2026-07')
                .expect(200)
        ).body as SalaryAccrualListResponse;
        expect(list.items).toHaveLength(1);
        const accrualId = list.items[0].id;
        expect(list.items[0].status).toBe('DRAFT');

        // 2) Начисление — «Начислить всё» по документу (PRD 2): движение
        // SALARY_ACCRUAL на баланс, документ → ACCRUED.
        const accrueResult = (
            await request(app.getHttpServer())
                .post(
                    `/v1/service/accounting/salary_accruals/${accrualId}/accrue`,
                )
                .send({ accruedBy: 7 })
                .expect(201)
        ).body as AccrueSalaryAccrualDocumentResponse;
        expect(accrueResult.failures).toEqual([]);
        expect(accrueResult.accrual.status).toBe('ACCRUED');

        const balanceAfterAccrual = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/employee/42')
                .expect(200)
        ).body as EmployeeBalanceResponse;
        const accruedAmount = balanceAfterAccrual.balance;
        expect(accruedAmount).toBeGreaterThan(0);

        // 3) Выплата на всю сумму остатка (PRD 3: «сначала ERP, затем
        // транзакция БД») — движение PAYOUT + Cashbox + документ
        // начисления → PAID, т.к. остаток после операции 0.
        const erpCreateCallsBefore = erpCreateCalls.length;
        const payout = (
            await request(app.getHttpServer())
                .post('/v1/service/accounting/payout')
                .send({
                    employeeId: 42,
                    amount: accruedAmount,
                    occurredAt: '2026-07-25T00:00:00.000Z',
                    createdBy: 7,
                })
                .expect(201)
        ).body as PayoutResponse;
        expect(payout.transaction).toMatchObject({
            type: 'PAYOUT',
            amount: -accruedAmount,
            employeeId: 42,
            direction: 'service',
            erpSyncRequired: true,
        });
        expect(payout.erpDocument).toMatchObject({
            system: 'ROAPP',
            kind: 'OUTCOME',
            amount: accruedAmount,
        });
        expect(erpCreateCalls.length).toBe(erpCreateCallsBefore + 1);
        expect(erpCreateCalls.at(-1)).toMatchObject({
            kind: 'OUTCOME',
            amount: accruedAmount,
            employeeId: 42,
        });

        const balanceAfterPayout = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/employee/42')
                .expect(200)
        ).body as EmployeeBalanceResponse;
        expect(balanceAfterPayout.balance).toBe(0);

        const accrualAfterPayout = (
            await request(app.getHttpServer())
                .get(`/v1/service/accounting/salary_accruals/${accrualId}`)
                .expect(200)
        ).body as SalaryAccrualResponse;
        expect(accrualAfterPayout.status).toBe('PAID');
        expect(
            accrualAfterPayout.lines.every((line) => line.status === 'PAID'),
        ).toBe(true);

        // 4) Повторная выплата уже выплаченному сотруднику без подтверждения
        // отклоняется 409 с текущим (нулевым) остатком в ответе (PRD 3).
        const rejected = (
            await request(app.getHttpServer())
                .post('/v1/service/accounting/payout')
                .send({ employeeId: 42, amount: 500, createdBy: 7 })
                .expect(409)
        ).body as ApiErrorResponse;
        expect(rejected.metadata as PayoutConfirmationRequired).toMatchObject({
            employeeId: 42,
            balance: 0,
        });

        // 5) Удаление выплаты (PRD 3: «сначала ERP, затем в одной
        // транзакции — движение с баланса и возврат документов начисления
        // из PAID в ACCRUED»): остаток возвращается, документ снова ACCRUED.
        const erpDeleteCallsBefore = erpDeleteCalls.length;
        await request(app.getHttpServer())
            .delete(`/v1/service/accounting/payout/${payout.transaction.id}`)
            .expect(204);
        expect(erpDeleteCalls.length).toBe(erpDeleteCallsBefore + 1);
        expect(erpDeleteCalls.at(-1)).toMatchObject({
            externalId: payout.erpDocument.externalId,
            kind: 'OUTCOME',
            amount: accruedAmount,
        });

        const balanceAfterDelete = (
            await request(app.getHttpServer())
                .get('/v1/accounting/balance/employee/42')
                .expect(200)
        ).body as EmployeeBalanceResponse;
        expect(balanceAfterDelete.balance).toBe(accruedAmount);
        expect(
            balanceAfterDelete.transactions.some(
                (transaction) => transaction.id === payout.transaction.id,
            ),
        ).toBe(false);

        const accrualAfterDelete = (
            await request(app.getHttpServer())
                .get(`/v1/service/accounting/salary_accruals/${accrualId}`)
                .expect(200)
        ).body as SalaryAccrualResponse;
        expect(accrualAfterDelete.status).toBe('ACCRUED');
        expect(
            accrualAfterDelete.lines.every((line) => line.status === 'ACCRUED'),
        ).toBe(true);

        // Локальная связка удалена вместе с движением — «либо есть оба,
        // либо нет ни одного» (PRD 3, «Цель»).
        await expect(
            payoutCashboxRecordRepo.findByTransactionId(payout.transaction.id),
        ).resolves.toBeNull();

        // 6) Документ ERP в ERP уже удалён — повторный DELETE payout не
        // существующего движения PAYOUT это движение больше не найдёт (404).
        await request(app.getHttpServer())
            .delete(`/v1/service/accounting/payout/${payout.transaction.id}`)
            .expect(404);
    });
});
