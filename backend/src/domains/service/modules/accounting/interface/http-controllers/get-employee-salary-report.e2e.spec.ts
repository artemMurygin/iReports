import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type { EmployeeSalaryReportResponse } from 'ireports-contracts';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { AccountingModule } from '@/domains/service/modules/accounting/accounting.module';
import { MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import type { MotivationSchemaRepositoryPort } from '@/domains/service/modules/accounting/application/ports/motivation-schema.port';
import { SALARY_RULE_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import type { SalaryRuleRepositoryPort } from '@/domains/service/modules/accounting/application/ports/salary-rule.port';
import { ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import type { AccountingPeriodRepositoryPort } from '@/domains/service/modules/accounting/application/ports/accounting-period.port';
import { ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
import type { AccountingPeriodSnapshotPort } from '@/domains/service/modules/accounting/application/ports/accounting-period-snapshot.port';
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
import { PayPerHoursEntity } from '@/domains/service/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import { SHOP_CALCULATION_DATA } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';

// Настоящей инфраструктуры для test:e2e (jest-e2e.json + отдельная БД) в
// проекте пока нет (см. backend/CLAUDE.md — упомянутый конфиг не заведён).
// Этот тест — ближайший к нему эквивалент, который реально выполняется в
// npm run test: поднимает AccountingModule целиком через Nest TestingModule
// (реальные Controller → Service → Orchestrator → Entity), подменяя только
// границу с БД на in-memory реализации портов. С Фазы 6 AccountingModule
// импортирует SalesModule (SALES_PLAN_REPOSITORY нужен и закрытию периода, и
// ленивому кэшу отчёта) — часть провайдеров SalesModule (SalesPlanTemplateRepository,
// RoappSalesFactSourceRepository и т.п.), которые этот эндпоинт не
// использует, всё равно конструируются Nest DI и просто хранят
// DatabaseService в поле, поэтому им достаточно фейкового DatabaseService,
// а не реального Postgres (тот же приём, что и с UNIT_OF_WORK ниже). Фаза
// 13.5 добавила зеркальную зависимость на ShopAccountingModule (через
// AccountingModule) — SHOP_MOTIVATION_SCHEMA_REPOSITORY/SHOP_CALCULATION_DATA
// подменяются тем же приёмом; сквозной сценарий записи и чтения обоих
// направлений сразу (включая дедуп MotivationSchema и независимое закрытие
// периода) — отдельный файл shop-report-integration.e2e.spec.ts в этой же
// директории, а не этот тест (он остаётся узким тестом одного направления).
describe('GET /accounting/salary_report/employee/:id/:period (e2e)', () => {
    let app: INestApplication;
    const schemas = new Map<number, MotivationSchema>();

    const fakeMotivationSchemaRepo: MotivationSchemaRepositoryPort = {
        insert: (entity) => {
            schemas.set(entity.getProps().target.getId(), entity);
            return Promise.resolve();
        },
        findByEmployee: (employeeId) =>
            Promise.resolve(schemas.get(employeeId) ?? null),
        findByEmployees: (employeeIds) =>
            Promise.resolve(
                employeeIds
                    .map((id) => schemas.get(id))
                    .filter((schema): schema is MotivationSchema => !!schema),
            ),
        findAllEmployeeTargets: () =>
            Promise.resolve(Array.from(schemas.values())),
    };
    const fakeSalaryRuleRepo: SalaryRuleRepositoryPort = {
        insert: () => Promise.resolve(),
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
    // Часы (Фаза 7) больше не в config правила — источник данных для
    // BuildServiceCalculationContextService, hoursWorked: 8 сохраняет
    // числовые ожидания теста (2000 = 8ч × 250).
    // Фаза 8 расширила порт тремя источниками (OrderPayed/TaskCompleted/
    // отдел сотрудника) — пустые/null здесь достаточны: тест проверяет
    // только PayPerHour, а findEmployeeDepartmentId: null отключает поход
    // в SalesPerformanceReaderPort (см. buildSalesPerformance) — реального
    // Postgres в этом e2e-тесте нет, а SALES_PERFORMANCE_READER здесь не
    // подменяется.
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
    // Фаза 13.5: GetEmployeeSalaryReportService теперь всегда строит ОБА
    // направления (см. combineDirections) — этот тест проверяет только
    // service, поэтому shop-сторона намеренно пустая (без личной схемы, без
    // erpData), а не подмена бизнес-логики: направление shop всё равно
    // должно попасть в directions[] с total 0 и isClosed: false, иначе
    // отчёт сотрудника без схемы магазина не отличить от ошибки.
    const fakeShopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort = {
        insert: () => Promise.resolve(),
        findByEmployee: () => Promise.resolve(null),
        findByEmployees: () => Promise.resolve([]),
        findAllEmployeeTargets: () => Promise.resolve([]),
        findIdByTarget: () => Promise.resolve(null),
    };
    const fakeShopCalculationData: ShopCalculationDataPort = {
        findEmployeeIdentities: () => Promise.resolve([]),
        findHoursWorked: () => Promise.resolve(0),
        findProductSoldItems: () => Promise.resolve([]),
        findConfirmedTaskCompletions: () => Promise.resolve([]),
        findEmployeeDepartmentId: () => Promise.resolve(null),
        findEmployeesInDepartment: () => Promise.resolve([]),
        findEmployeeIdentitiesForEmployees: () => Promise.resolve(new Map()),
        findHoursWorkedForEmployees: () => Promise.resolve(new Map()),
        resolveCategoryDescendantFolderIds: () => Promise.resolve({}),
    };
    // AccountingModule заодно поднимает CreateMotivationSchemaHandler (не
    // используется этим эндпоинтом), которому нужен UNIT_OF_WORK — реальный
    // PrismaUnitOfWork приходит из @Global() DatabaseModule (требует живой
    // Postgres). overrideProvider() не годится: он лишь подменяет уже
    // объявленный в графе модулей провайдер, а этот здесь никем не
    // объявлен — поэтому регистрируем его сами тем же способом
    // (@Global()-модуль), каким это в реальном приложении делает
    // DatabaseModule.
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
        const schema = withRequestContext(() => {
            const rule = PayPerHoursEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                config: { price: 250 },
            });
            return MotivationSchema.create({
                targetType: 'Employee',
                targetId: 42,
                name: 'Оклад инженера',
                rules: [rule],
            });
        });
        schemas.set(42, schema);

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
            .overrideProvider(SHOP_CALCULATION_DATA)
            .useValue(fakeShopCalculationData)
            .compile();

        app = moduleRef.createNestApplication();
        // Доменные исключения (ArgumentInvalidException и т.п.) читают
        // RequestContext в конструкторе (см. ExceptionBase) — в реальном
        // приложении его открывает RequestContextMiddleware, подключённый в
        // AppModule.configure(); здесь бутстрапится только AccountingModule,
        // поэтому подключаем ту же middleware вручную.
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

    it('возвращает итог и разбивку по правилам схемы сотрудника', async () => {
        const response = await request(app.getHttpServer())
            .get('/accounting/salary_report/employee/42/2026-08')
            .expect(200);
        const body = response.body as EmployeeSalaryReportResponse;

        expect(body).toMatchObject({
            period: '2026-08',
            // isClosed переехал с верхнего уровня в directions[] (Фаза
            // 13.5, Решение №1) — service и shop закрываются независимо.
            grandTotal: { fact: 2000, prognose: 2000 },
        });
        // grandTotal сходится с одним service-направлением, потому что
        // shop-сторона (см. fakeShopMotivationSchemaRepo/
        // fakeShopCalculationData выше) пуста — не потому, что shop
        // отсутствует в ответе: directions[] всегда содержит оба
        // направления (Фаза 13.5).
        expect(body.directions).toHaveLength(2);
        expect(body.directions[0]).toMatchObject({
            direction: 'service',
            isClosed: false,
            total: { fact: 2000, prognose: 2000 },
            isPlanApproved: true,
        });
        expect(body.directions[0].rules).toEqual([
            expect.objectContaining({
                type: 'PayPerHour',
                name: 'Почасовая ставка',
                targetRole: 'ENGINEER',
                amount: { fact: 2000, prognose: 2000 },
            }),
        ]);
        expect(body.directions[1]).toMatchObject({
            direction: 'shop',
            isClosed: false,
            total: { fact: 0, prognose: 0 },
        });
        expect(body.directions[1].rules).toEqual([]);
    });

    it('возвращает пустой отчёт для сотрудника без мотивационной схемы', async () => {
        const response = await request(app.getHttpServer())
            .get('/accounting/salary_report/employee/999/2026-08')
            .expect(200);
        const body = response.body as EmployeeSalaryReportResponse;

        expect(body).toMatchObject({
            grandTotal: { fact: 0, prognose: 0 },
        });
        expect(body.directions[0].rules).toEqual([]);
        expect(body.directions[1].rules).toEqual([]);
    });

    it('отклоняет период не в формате YYYY-MM', async () => {
        await request(app.getHttpServer())
            .get('/accounting/salary_report/employee/42/2026')
            .expect(400);
    });
});
