import type { Server } from 'http';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type { EmployeeSalaryReportResponse } from 'ireports-contracts';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { ShopAccountingModule } from '@/domains/shop/modules/accounting/shop-accounting.module';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-motivation-schema.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-salary-rule.port';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-salary-rule.port';
import { SHOP_TASK_COMPLETION_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/shop-task-completion.port';
import type { ShopTaskCompletionRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/shop-task-completion.port';
import { SHOP_CALCULATION_DATA } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/shop-calculation-data.port';
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
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/shop-motivation-schema.entity';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Настоящей инфраструктуры для test:e2e (jest-e2e.json + отдельная БД) в
// проекте пока нет (см. backend/CLAUDE.md) — этот тест, как и его зеркало
// domains/service/modules/accounting/interface/http-controllers/
// get-employee-salary-report.e2e.spec.ts, поднимает ShopAccountingModule
// целиком (реальные Controller → Service → Orchestrator → Entity),
// подменяя только границу с БД на in-memory реализации портов.
//
// GetShopEmployeeSalaryReportService (после разбора Фазы 13.5/4, см.
// docs/payroll/phase-13.5-shop-report-integration.md) отвечает строго за
// направление shop — ответ односторонний (period + один разбор
// направления, без directions[]/grandTotal, см.
// employeeSalaryReportResponseSchema в contracts). Зеркальный отчёт
// направления service — get-employee-salary-report.e2e.spec.ts домена
// service. Инвариант "сотрудник существует в обеих ERP одновременно, каждый
// эндпоинт видит только свой срез, они не влияют друг на друга" проверяется
// ДВУМЯ независимыми e2e-тестами (этим и его service-зеркалом) на одном и
// том же employeeId (42) — каждый файл использует собственный in-memory
// фейк репозитория схем, поэтому запись в одном не видна другому, как и в
// реальном приложении разные направления читают свои собственные ERP-
// данные (personal identities не пересекаются между тестами).
describe('GET /v1/shop/accounting/salary_report/employee/:id/:period (e2e)', () => {
    let app: INestApplication<Server>;
    const shopSchemas = new Map<number, ShopMotivationSchema>();

    const fakeShopMotivationSchemaRepo: ShopMotivationSchemaRepositoryPort = {
        insert: (entity) => {
            shopSchemas.set(entity.getProps().target.getId(), entity);
            return Promise.resolve();
        },
        findByEmployee: (employeeId) =>
            Promise.resolve(shopSchemas.get(employeeId) ?? null),
        findByEmployees: (employeeIds) =>
            Promise.resolve(
                employeeIds
                    .map((id) => shopSchemas.get(id))
                    .filter(
                        (schema): schema is ShopMotivationSchema => !!schema,
                    ),
            ),
        findAllEmployeeTargets: () =>
            Promise.resolve(Array.from(shopSchemas.values())),
        findIdByTarget: () => Promise.resolve(null),
    };
    const fakeShopSalaryRuleRepo: ShopSalaryRuleRepositoryPort = {
        insert: () => Promise.resolve(),
    };
    const fakeShopTaskCompletionRepo: ShopTaskCompletionRepositoryPort = {
        insert: () => Promise.resolve(),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        findById: () => Promise.resolve(null),
        findByPeriod: () => Promise.resolve([]),
        findConfirmedByPeriod: () => Promise.resolve([]),
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
    // hoursWorked: 5 — вместе с price 300 у схемы ниже даёт total 1500,
    // намеренно отличное от 2000 (8ч × 250) сервисного e2e-зеркала: числа
    // не должны совпадать, иначе равенство total между направлениями ничего
    // бы не доказывало о том, что каждое направление считает СВОЁ правило.
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
    // ShopAccountingModule заодно поднимает командные хендлеры
    // (CreateShopMotivationSchemaHandler и т.п., не используются этим
    // эндпоинтом), которым нужен UNIT_OF_WORK — тот же приём, что и в
    // сервисном e2e-зеркале: регистрируем фейк сами через @Global()-модуль,
    // а не overrideProvider (провайдер здесь никем не объявлен явно).
    // ShopSalesModule/MoySkladSyncModule (импортированы ShopAccountingModule)
    // тоже конструируют часть своих провайдеров (MoySkladSalesFactSourceRepository,
    // ProductFolderTreeService и т.п.) — этот эндпоинт их не вызывает, им
    // достаточно фейкового DatabaseService, они просто хранят его в поле.
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
        const shopSchema = withRequestContext(() => {
            const rule = PayPerHourShopEntity.create({
                type: 'PayPerHour',
                name: 'Почасовая ставка (магазин)',
                targetRole: 'ONLINE_MANAGER',
                config: { price: 300 },
            });
            return ShopMotivationSchema.create({
                targetType: 'Employee',
                targetId: 42,
                name: 'Оклад продавца',
                rules: [rule],
            });
        });
        shopSchemas.set(42, shopSchema);

        const moduleRef = await Test.createTestingModule({
            imports: [FakeInfrastructureModule, ShopAccountingModule],
        })
            .overrideProvider(SHOP_MOTIVATION_SCHEMA_REPOSITORY)
            .useValue(fakeShopMotivationSchemaRepo)
            .overrideProvider(SHOP_SALARY_RULE_REPOSITORY)
            .useValue(fakeShopSalaryRuleRepo)
            .overrideProvider(SHOP_TASK_COMPLETION_REPOSITORY)
            .useValue(fakeShopTaskCompletionRepo)
            .overrideProvider(SHOP_CALCULATION_DATA)
            .useValue(fakeShopCalculationData)
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
            .compile();

        app = moduleRef.createNestApplication();
        // Доменные исключения читают RequestContext в конструкторе — см. тот
        // же приём в сервисном e2e-зеркале.
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

    it('возвращает итог и разбивку по правилам схемы сотрудника магазина', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/shop/accounting/salary_report/employee/42/2026-08')
            .expect(200);
        const body = response.body as EmployeeSalaryReportResponse;

        expect(body).toEqual({
            period: '2026-08',
            direction: 'shop',
            isClosed: false,
            total: { fact: 1500, prognose: 1500 },
            rules: [
                expect.objectContaining({
                    type: 'PayPerHour',
                    name: 'Почасовая ставка (магазин)',
                    targetRole: 'ONLINE_MANAGER',
                    amount: { fact: 1500, prognose: 1500 },
                }),
            ],
            salesPerformance: null,
            isPlanApproved: true,
        });
    });

    it('возвращает пустой отчёт для сотрудника без мотивационной схемы магазина', async () => {
        const response = await request(app.getHttpServer())
            .get('/v1/shop/accounting/salary_report/employee/999/2026-08')
            .expect(200);
        const body = response.body as EmployeeSalaryReportResponse;

        expect(body).toMatchObject({
            direction: 'shop',
            isClosed: false,
            total: { fact: 0, prognose: 0 },
            rules: [],
        });
    });

    it('отклоняет период не в формате YYYY-MM', async () => {
        await request(app.getHttpServer())
            .get('/v1/shop/accounting/salary_report/employee/42/2026')
            .expect(400);
    });
});
