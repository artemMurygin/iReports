import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type {
    AccountingPeriodResponse,
    EmployeeSalaryReportResponse,
    TaskCompletionResponse,
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
import { DOMAIN_SYNC_STATUS } from '@/shared/application/ports/domain-sync-status.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { SERVICE_CALCULATION_DATA } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import type { ServiceCalculationDataPort } from '@/domains/service/modules/accounting/application/ports/service-calculation-data.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { MotivationSchema } from '@/domains/service/modules/accounting/domain/entities/motivation-schema.entity';
import { MotivationTarget } from '@/domains/service/modules/accounting/domain/value-objects/motivation-target.value-object';
import type { SalaryRule } from '@/domains/service/modules/accounting/domain/types/salary-rule.types';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-salary-rule.port';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-salary-rule.port';
import { SHOP_TASK_COMPLETION_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-task-completion.port';
import type { ShopTaskCompletionRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-task-completion.port';
import { SHOP_CALCULATION_DATA } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';
import { ShopMotivationTarget } from '@/domains/shop/modules/accounting/domain/value-objects/shop-motivation-target.value-object';
import type { ShopSalaryRule } from '@/domains/shop/modules/accounting/domain/types/shop-salary-rule.types';
import { ShopTaskCompletion } from '@/domains/shop/modules/accounting/domain/entities/shop-task-completion.entity';
import type { EmployeeIdentityRef } from '@/shared/domain/calculation-context';

// Сквозной регресс Фазы 13.5 (см.
// docs/payroll/phase-13.5-shop-report-integration.md, раздел 7 "Тесты" —
// "сквозной e2e: сотрудник с идентичностями в обеих ERP получает
// объединённый отчёт, одна строка motivation_schemas в БД, закрытие service
// не трогает shop"). Поднимает AccountingModule целиком (тот же приём, что
// у get-employee-salary-report.e2e.spec.ts в этой же директории — см. её
// шапку про отсутствие настоящей test:e2e-инфраструктуры/отдельной БД в
// проекте) через реальный HTTP-контур
// Controller → CommandBus/Service → Orchestrator → Entity, подменяя только
// границу с БД на in-memory реализации портов.
//
// Одна деталь заслуживает отдельного объяснения: MotivationSchema в
// реальной БД — ОДНА таблица (`motivation_schemas`) без колонки direction,
// на которую пишут ОБА направления (see CreateMotivationSchemaHandler/
// CreateShopMotivationSchemaHandler, find-or-create по (targetType,
// targetId)). Чтобы честно проверить именно эту дедупликацию через HTTP
// без реального Postgres, фейковые репозитории service и shop ниже не
// изолированы друг от друга — они читают и пишут ОДНУ общую in-memory
// "таблицу" motivationSchemaRows (естественный ключ targetType:targetId) и
// ОДИН общий счётчик genuine-инсертов, в точности как это делает
// findIdByTarget/insert() на настоящей БД. Правила (salary_rules) в
// реальной схеме — отдельная таблица со своим direction, поэтому у service
// и shop свои собственные хранилища правил, связанные с общей строкой
// схемы через motivationSchemaId (см. serviceRulesBySchemaId/
// shopRulesBySchemaId ниже) — то же разделение, что и в реальных
// SalaryRuleRepository/ShopSalaryRuleRepository.
describe('Фаза 13.5: сквозная интеграция отчёта/закрытия периода с shop (e2e)', () => {
    let app: INestApplication;

    const CROSS_ERP_EMPLOYEE_ID = 777;
    const PERIOD = '2026-08';

    // ===== Общая "таблица" motivation_schemas (Решение issue #57: строка
    // без direction, дедуп по (targetType, targetId) через findIdByTarget) =====
    const motivationSchemaRows = new Map<
        string,
        {
            id: string;
            targetType: 'Employee' | 'Department';
            targetId: number;
            name: string;
        }
    >();
    let motivationSchemaInsertCount = 0;
    const targetKey = (targetType: string, targetId: number): string =>
        `${targetType}:${targetId}`;

    // ===== Правила — отдельные таблицы по направлениям (общая схема, свои
    // строки правил) =====
    const serviceRulesBySchemaId = new Map<string, SalaryRule[]>();
    const shopRulesBySchemaId = new Map<string, ShopSalaryRule[]>();

    const fakeMotivationSchemaRepo: MotivationSchemaRepositoryPort = {
        insert: (entity) => {
            const props = entity.getProps();
            motivationSchemaRows.set(
                targetKey(props.target.getType(), props.target.getId()),
                {
                    id: entity.id,
                    targetType: props.target.getType(),
                    targetId: props.target.getId(),
                    name: props.name,
                },
            );
            motivationSchemaInsertCount += 1;
            return Promise.resolve();
        },
        findByEmployee: (employeeId) => {
            const row = motivationSchemaRows.get(
                targetKey('Employee', employeeId),
            );
            if (!row) {
                return Promise.resolve(null);
            }
            return Promise.resolve(
                new MotivationSchema({
                    id: row.id,
                    props: {
                        target: MotivationTarget.create(
                            'Employee',
                            row.targetId,
                        ),
                        name: row.name,
                        rules: serviceRulesBySchemaId.get(row.id) ?? [],
                    },
                }),
            );
        },
        findByEmployees: async (employeeIds) => {
            const results = await Promise.all(
                employeeIds.map((id) =>
                    fakeMotivationSchemaRepo.findByEmployee(id),
                ),
            );
            return results.filter((s): s is MotivationSchema => !!s);
        },
        findAllEmployeeTargets: async () => {
            const results = await Promise.all(
                Array.from(motivationSchemaRows.values())
                    .filter((row) => row.targetType === 'Employee')
                    .map((row) =>
                        fakeMotivationSchemaRepo.findByEmployee(row.targetId),
                    ),
            );
            return results.filter((s): s is MotivationSchema => !!s);
        },
        findIdByTarget: (targetType, targetId) =>
            Promise.resolve(
                motivationSchemaRows.get(targetKey(targetType, targetId))?.id ??
                    null,
            ),
    };

    const fakeSalaryRuleRepo: SalaryRuleRepositoryPort = {
        insert: (entity, meta) => {
            const rules =
                serviceRulesBySchemaId.get(meta.motivationSchemaId) ?? [];
            rules.push(entity);
            serviceRulesBySchemaId.set(meta.motivationSchemaId, rules);
            return Promise.resolve();
        },
    };

    const fakeShopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort = {
        insert: (entity) => {
            const props = entity.getProps();
            motivationSchemaRows.set(
                targetKey(props.target.getType(), props.target.getId()),
                {
                    id: entity.id,
                    targetType: props.target.getType(),
                    targetId: props.target.getId(),
                    name: props.name,
                },
            );
            motivationSchemaInsertCount += 1;
            return Promise.resolve();
        },
        findByEmployee: (employeeId) => {
            const row = motivationSchemaRows.get(
                targetKey('Employee', employeeId),
            );
            if (!row) {
                return Promise.resolve(null);
            }
            return Promise.resolve(
                new ShopMotivationSchema({
                    id: row.id,
                    props: {
                        target: ShopMotivationTarget.create(
                            'Employee',
                            row.targetId,
                        ),
                        name: row.name,
                        rules: shopRulesBySchemaId.get(row.id) ?? [],
                    },
                }),
            );
        },
        findByEmployees: async (employeeIds) => {
            const results = await Promise.all(
                employeeIds.map((id) =>
                    fakeShopMotivationSchemaRepo.findByEmployee(id),
                ),
            );
            return results.filter((s): s is ShopMotivationSchema => !!s);
        },
        findAllEmployeeTargets: async () => {
            const results = await Promise.all(
                Array.from(motivationSchemaRows.values())
                    .filter((row) => row.targetType === 'Employee')
                    .map((row) =>
                        fakeShopMotivationSchemaRepo.findByEmployee(
                            row.targetId,
                        ),
                    ),
            );
            return results.filter((s): s is ShopMotivationSchema => !!s);
        },
        findIdByTarget: (targetType, targetId) =>
            Promise.resolve(
                motivationSchemaRows.get(targetKey(targetType, targetId))?.id ??
                    null,
            ),
    };

    const fakeShopSalaryRuleRepo: ShopSalaryRuleRepositoryPort = {
        insert: (entity, meta) => {
            const rules =
                shopRulesBySchemaId.get(meta.motivationSchemaId) ?? [];
            rules.push(entity);
            shopRulesBySchemaId.set(meta.motivationSchemaId, rules);
            return Promise.resolve();
        },
    };

    // ===== Расчётный период — свой ключ (direction, period), закрытие
    // service не должно трогать строку shop (см. заголовок describe) =====
    const accountingPeriods = new Map<
        string,
        Parameters<AccountingPeriodRepositoryPort['save']>[0]
    >();
    const periodKey = (direction: string, period: string): string =>
        `${direction}:${period}`;

    const fakeAccountingPeriodRepo: AccountingPeriodRepositoryPort = {
        findByDirectionAndPeriod: (direction, period) =>
            Promise.resolve(
                accountingPeriods.get(periodKey(direction, period)) ?? null,
            ),
        save: (entity) => {
            accountingPeriods.set(
                periodKey(entity.direction, entity.period),
                entity,
            );
            return Promise.resolve();
        },
    };

    const snapshots = new Map<string, AccountingPeriodSnapshotRow>();
    const snapshotKey = (
        direction: string,
        period: string,
        employeeId: number,
    ): string => `${direction}:${period}:${employeeId}`;

    const fakeAccountingPeriodSnapshot: AccountingPeriodSnapshotPort = {
        saveAll: (_periodId, direction, period, rows) => {
            for (const row of rows) {
                snapshots.set(
                    snapshotKey(direction, period, row.employeeId),
                    row,
                );
            }
            return Promise.resolve();
        },
        findByKey: (direction, period, employeeId) =>
            Promise.resolve(
                snapshots.get(snapshotKey(direction, period, employeeId)) ??
                    null,
            ),
        findManyByKey: (direction, period, employeeIds) => {
            const map = new Map<number, AccountingPeriodSnapshotRow>();
            for (const employeeId of employeeIds) {
                const row = snapshots.get(
                    snapshotKey(direction, period, employeeId),
                );
                if (row) {
                    map.set(employeeId, row);
                }
            }
            return Promise.resolve(map);
        },
        deleteByDirectionAndPeriod: (direction, period) => {
            for (const key of Array.from(snapshots.keys())) {
                if (key.startsWith(`${direction}:${period}:`)) {
                    snapshots.delete(key);
                }
            }
            return Promise.resolve();
        },
    };

    // Ленивый кэш расчёта намеренно "всегда мимо" — тест не проверяет
    // инвалидацию кэша (это покрыто отдельными юнит-тестами
    // accounting-cache-freshness), только правильность самого расчёта и
    // независимость направлений при закрытии.
    const fakeAccountingCalculationCache: AccountingCalculationCachePort = {
        find: () => Promise.resolve(null),
        upsert: () => Promise.resolve(),
        deleteByDirectionAndPeriod: () => Promise.resolve(),
    };
    const fakeDomainSyncStatus: DomainSyncStatusPort = {
        getLastSuccessfulSyncAt: () => Promise.resolve(null),
        markSuccessful: () => Promise.resolve(),
    };
    // Ни одной неутверждённой строки плана продаж ни у одного направления —
    // закрытие периода (service и shop по отдельности) не должно
    // отклоняться UnapprovedSalesPlanRowsException, это не то, что
    // проверяет этот тест.
    const fakeSalesPlanRepo: SalesPlanRepositoryPort = {
        insert: () => Promise.resolve(),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        findById: () => Promise.resolve(null),
        findByIds: () => Promise.resolve([]),
        findByScope: () => Promise.resolve(null),
        findByDirectionAndPeriod: () => Promise.resolve([]),
    };

    // Сотрудник с идентичностями в ОБЕИХ ERP (шаг "a" сценария) — вместо
    // прямой записи EmployeeIdentity/BitrixEmployee в Postgres (которого в
    // этом e2e-контуре нет, см. шапку файла) идентичности отдаются тем же
    // способом, каким BuildServiceCalculationContextService/
    // BuildShopCalculationContextService реально их получают — через
    // ServiceCalculationDataPort/ShopCalculationDataPort.findEmployeeIdentities.
    const crossErpIdentities: EmployeeIdentityRef[] = [
        {
            system: 'ROAPP',
            identifierType: 'EMPLOYEE_ID',
            externalId: 'roapp-777',
        },
        {
            system: 'MOY_SKLAD',
            identifierType: 'EMPLOYEE_ID',
            externalId: 'moysklad-777',
        },
    ];

    // hoursWorked разные у направлений (8ч × 250₽ = 2000 у service, 5ч ×
    // 300₽ = 1500 у shop) — числа должны различаться, иначе совпадение
    // total.fact между направлениями в ответе не доказывало бы, что каждое
    // направление действительно считает СВОЁ правило, а не одно на двоих.
    const fakeServiceCalculationData: ServiceCalculationDataPort = {
        findEmployeeIdentities: () => Promise.resolve(crossErpIdentities),
        findServiceCompletedItems: () => Promise.resolve([]),
        findHoursWorked: () => Promise.resolve(8),
        findOrderPayedItems: () => Promise.resolve([]),
        findConfirmedTaskCompletions: () => Promise.resolve([]),
        findEmployeeDepartmentId: () => Promise.resolve(null),
        findEmployeesInDepartment: () => Promise.resolve([]),
        findEmployeeIdentitiesForEmployees: () => Promise.resolve(new Map()),
        findHoursWorkedForEmployees: () => Promise.resolve(new Map()),
    };
    const fakeShopCalculationData: ShopCalculationDataPort = {
        findEmployeeIdentities: () => Promise.resolve(crossErpIdentities),
        findHoursWorked: () => Promise.resolve(5),
        findProductSoldItems: () => Promise.resolve([]),
        findConfirmedTaskCompletions: () => Promise.resolve([]),
        findEmployeeDepartmentId: () => Promise.resolve(null),
        findEmployeesInDepartment: () => Promise.resolve([]),
        findEmployeeIdentitiesForEmployees: () => Promise.resolve(new Map()),
        findHoursWorkedForEmployees: () => Promise.resolve(new Map()),
        resolveCategoryDescendantFolderIds: () => Promise.resolve({}),
    };

    // ===== shop_task_completions — простой CRUD, зеркало реального
    // ShopTaskCompletionRepository =====
    const shopTaskCompletions = new Map<string, ShopTaskCompletion>();
    const fakeShopTaskCompletionRepo: ShopTaskCompletionRepositoryPort = {
        insert: (entity) => {
            shopTaskCompletions.set(entity.id, entity);
            return Promise.resolve();
        },
        update: (entity) => {
            shopTaskCompletions.set(entity.id, entity);
            return Promise.resolve();
        },
        delete: (id) => {
            shopTaskCompletions.delete(id);
            return Promise.resolve();
        },
        findById: (id) => Promise.resolve(shopTaskCompletions.get(id) ?? null),
        findByPeriod: (period, employeeId) =>
            Promise.resolve(
                Array.from(shopTaskCompletions.values()).filter(
                    (c) =>
                        c.period === period &&
                        (employeeId === undefined ||
                            c.employeeId === employeeId),
                ),
            ),
        findConfirmedByPeriod: (period) =>
            Promise.resolve(
                Array.from(shopTaskCompletions.values()).filter(
                    (c) => c.period === period && c.isConfirmed(),
                ),
            ),
    };

    // CreateMotivationSchemaHandler/CreateShopMotivationSchemaHandler
    // (find-or-create) выполняют весь путь внутри unitOfWork.run() — реальный
    // PrismaUnitOfWork требует живой Postgres (см. get-employee-salary-report.e2e.spec.ts,
    // тот же приём).
    const fakeUnitOfWork: UnitOfWorkPort = {
        run: (work) => work(),
    };
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
        const moduleRef = await Test.createTestingModule({
            imports: [FakeInfrastructureModule, AccountingModule],
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
            .overrideProvider(DOMAIN_SYNC_STATUS)
            .useValue(fakeDomainSyncStatus)
            .overrideProvider(SALES_PLAN_REPOSITORY)
            .useValue(fakeSalesPlanRepo)
            .overrideProvider(SERVICE_CALCULATION_DATA)
            .useValue(fakeServiceCalculationData)
            .overrideProvider(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
            .useValue(fakeShopMotivationSchemaRepo)
            .overrideProvider(SHOP_SALARY_RULE_REPOSITORY)
            .useValue(fakeShopSalaryRuleRepo)
            .overrideProvider(SHOP_TASK_COMPLETION_REPOSITORY)
            .useValue(fakeShopTaskCompletionRepo)
            .overrideProvider(SHOP_CALCULATION_DATA)
            .useValue(fakeShopCalculationData)
            .compile();

        app = moduleRef.createNestApplication();
        // Доменные исключения читают RequestContext в конструкторе — см.
        // тот же приём в get-employee-salary-report.e2e.spec.ts.
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(
                req as never,
                res as never,
                next,
            ),
        );
        app.useGlobalPipes(new ZodValidationPipe());
        app.useGlobalFilters(new DomainExceptionFilter());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('сотрудник с идентичностями в обеих ERP получает объединённый отчёт с одной строкой мотивационной схемы, закрытие service не трогает shop, task_completions магазина проходят полный HTTP round-trip', async () => {
        // --- b) POST /v1/motivation-schema (service, PayPerHour) ---
        await request(app.getHttpServer())
            .post('/v1/motivation-schema')
            .send({
                targetType: 'Employee',
                targetId: CROSS_ERP_EMPLOYEE_ID,
                name: 'Оклад инженера (service)',
                rules: [
                    {
                        type: 'PayPerHour',
                        name: 'Почасовая ставка (service)',
                        targetRole: 'ENGINEER',
                        config: { price: 250 },
                    },
                ],
            })
            .expect(201);

        // --- c) POST /shop/accounting/motivation-schema (shop, тот же targetId) ---
        await request(app.getHttpServer())
            .post('/shop/accounting/motivation-schema')
            .send({
                targetType: 'Employee',
                targetId: CROSS_ERP_EMPLOYEE_ID,
                name: 'Оклад инженера (shop)',
                rules: [
                    {
                        type: 'PayPerHour',
                        name: 'Почасовая ставка (shop)',
                        targetRole: 'ONLINE_MANAGER',
                        config: { price: 300 },
                    },
                ],
            })
            .expect(201);

        // --- d) ровно одна строка motivation_schemas на этот targetId,
        // несмотря на два независимых POST с разных направлений (find-or-
        // create дедупликация, см. шапку файла) ---
        expect(motivationSchemaInsertCount).toBe(1);
        const rowsForEmployee = Array.from(
            motivationSchemaRows.values(),
        ).filter(
            (row) =>
                row.targetType === 'Employee' &&
                row.targetId === CROSS_ERP_EMPLOYEE_ID,
        );
        expect(rowsForEmployee).toHaveLength(1);

        // --- e) GET отчёта — оба направления, оба открыты, каждое со
        // своими правилами, grandTotal — вменяемые числа ---
        const firstReport = await request(app.getHttpServer())
            .get(
                `/accounting/salary_report/employee/${CROSS_ERP_EMPLOYEE_ID}/${PERIOD}`,
            )
            .expect(200);
        const firstBody = firstReport.body as EmployeeSalaryReportResponse;

        expect(firstBody.directions).toHaveLength(2);
        const [serviceDirection, shopDirection] = firstBody.directions;
        expect(serviceDirection).toMatchObject({
            direction: 'service',
            isClosed: false,
            total: { fact: 2000, prognose: 2000 },
        });
        expect(serviceDirection.rules).toEqual([
            expect.objectContaining({
                type: 'PayPerHour',
                name: 'Почасовая ставка (service)',
                targetRole: 'ENGINEER',
                amount: { fact: 2000, prognose: 2000 },
            }),
        ]);
        expect(shopDirection).toMatchObject({
            direction: 'shop',
            isClosed: false,
            total: { fact: 1500, prognose: 1500 },
        });
        expect(shopDirection.rules).toEqual([
            expect.objectContaining({
                type: 'PayPerHour',
                name: 'Почасовая ставка (shop)',
                targetRole: 'ONLINE_MANAGER',
                amount: { fact: 1500, prognose: 1500 },
            }),
        ]);
        expect(Number.isNaN(firstBody.grandTotal.fact)).toBe(false);
        expect(Number.isNaN(firstBody.grandTotal.prognose)).toBe(false);
        expect(firstBody.grandTotal).toEqual({ fact: 3500, prognose: 3500 });

        // --- f) закрыть ТОЛЬКО направление service ---
        const closeResponse = await request(app.getHttpServer())
            .post(`/accounting/period/service/${PERIOD}/close`)
            .send({ closedBy: 1 })
            .expect(201);
        const closedPeriod = closeResponse.body as AccountingPeriodResponse;
        expect(closedPeriod).toMatchObject({
            direction: 'service',
            period: PERIOD,
            status: 'CLOSED',
        });

        // --- g) повторный GET — service закрыт (prognose: null), shop БЕЗ
        // ИЗМЕНЕНИЙ (по-прежнему открыт, с тем же реальным прогнозом) ---
        const secondReport = await request(app.getHttpServer())
            .get(
                `/accounting/salary_report/employee/${CROSS_ERP_EMPLOYEE_ID}/${PERIOD}`,
            )
            .expect(200);
        const secondBody = secondReport.body as EmployeeSalaryReportResponse;

        expect(secondBody.directions).toHaveLength(2);
        expect(secondBody.directions[0]).toMatchObject({
            direction: 'service',
            isClosed: true,
            total: { fact: 2000, prognose: null },
        });
        expect(secondBody.directions[1]).toMatchObject({
            direction: 'shop',
            isClosed: false,
            total: { fact: 1500, prognose: 1500 },
        });
        expect(secondBody.directions[1].rules).toEqual([
            expect.objectContaining({
                type: 'PayPerHour',
                name: 'Почасовая ставка (shop)',
                amount: { fact: 1500, prognose: 1500 },
            }),
        ]);
        // grandTotal.prognose закрытого направления берёт fact (Решение №2
        // плана, см. combineDirections в GetEmployeeSalaryReportService) —
        // 2000 (service.fact) + 1500 (shop.prognose) = 3500, тот же итог,
        // что и до закрытия, а не заниженный/NaN.
        expect(Number.isNaN(secondBody.grandTotal.fact)).toBe(false);
        expect(Number.isNaN(secondBody.grandTotal.prognose)).toBe(false);
        expect(secondBody.grandTotal).toEqual({ fact: 3500, prognose: 3500 });

        // --- h) task_completions магазина — create → confirm → list round-trip ---
        const createTaskResponse = await request(app.getHttpServer())
            .post('/shop/accounting/task_completions')
            .send({
                employeeId: CROSS_ERP_EMPLOYEE_ID,
                period: PERIOD,
                description: 'Разобрал витрину и обновил ценники',
                createdBy: CROSS_ERP_EMPLOYEE_ID,
            })
            .expect(201);
        const createdTask = createTaskResponse.body as TaskCompletionResponse;
        expect(createdTask).toMatchObject({
            employeeId: CROSS_ERP_EMPLOYEE_ID,
            period: PERIOD,
            status: 'PENDING_CONFIRMATION',
        });

        const confirmTaskResponse = await request(app.getHttpServer())
            .post(`/shop/accounting/task_completions/${createdTask.id}/confirm`)
            .send({ confirmedBy: 1 })
            .expect(201);
        const confirmedTask =
            confirmTaskResponse.body as TaskCompletionResponse;
        expect(confirmedTask).toMatchObject({
            id: createdTask.id,
            status: 'CONFIRMED',
            confirmedBy: 1,
        });

        const listTasksResponse = await request(app.getHttpServer())
            .get('/shop/accounting/task_completions')
            .query({ period: PERIOD })
            .expect(200);
        const taskList = listTasksResponse.body as TaskCompletionResponse[];
        expect(taskList).toHaveLength(1);
        expect(taskList[0]).toMatchObject({
            id: createdTask.id,
            employeeId: CROSS_ERP_EMPLOYEE_ID,
            status: 'CONFIRMED',
        });
    });
});
