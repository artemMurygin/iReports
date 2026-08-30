import type { Server } from 'http';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type { EmployeeSalaryReportResponse } from 'ireports-contracts';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { ShopAccountingModule } from '@/domains/shop/modules/accounting/accounting.module';
import { SHOP_MOTIVATION_SCHEMA_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import type { ShopMotivationSchemaRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/motivation-schema.port';
import { SHOP_SALARY_RULE_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import type { ShopSalaryRuleRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/motivation-schema/salary-rule.port';
import { SHOP_TASK_COMPLETION_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/task-completion/task-completion.port';
import type { ShopTaskCompletionRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/task-completion/task-completion.port';
import { SHOP_CALCULATION_DATA } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import type { ShopCalculationDataPort } from '@/domains/shop/modules/accounting/application/ports/calculation/calculation-data.port';
import { SHOP_ACCOUNTING_PERIOD_REPOSITORY } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import type { ShopAccountingPeriodRepositoryPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period.port';
import { SHOP_ACCOUNTING_PERIOD_SNAPSHOT } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import type { ShopAccountingPeriodSnapshotPort } from '@/domains/shop/modules/accounting/application/ports/accounting-period/accounting-period-snapshot.port';
import { SHOP_ACCOUNTING_CALCULATION_CACHE } from '@/domains/shop/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import type { ShopAccountingCalculationCachePort } from '@/domains/shop/modules/accounting/application/ports/calculation/accounting-calculation-cache.port';
import { DOMAIN_SYNC_STATUS } from '@/shared/application/ports/domain-sync-status.port';
import type { DomainSyncStatusPort } from '@/shared/application/ports/domain-sync-status.port';
import { SHOP_SALES_PLAN_REPOSITORY } from '@/domains/shop/modules/sales/application/ports/sales-plan.port';
import type { ShopSalesPlanRepositoryPort } from '@/domains/shop/modules/sales/application/ports/sales-plan.port';
import { SHOP_SALES_PERFORMANCE_READER } from '@/domains/shop/modules/sales/application/ports/sales-performance.port';
import type { ShopSalesPerformanceReaderPort } from '@/domains/shop/modules/sales/application/ports/sales-performance.port';
import type { ShopSalesPerformance } from '@/domains/shop/modules/sales/domain/value-objects/sales-performance.value-object';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { ShopMotivationSchema } from '@/domains/shop/modules/accounting/domain/entities/motivation-schema/motivation-schema.entity';
import { PayPerHourShopEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/pay-per-hour.entity';
import { ProductSoldEntity } from '@/domains/shop/modules/accounting/domain/entities/salary-rules/product-sold.entity';
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
            Promise.resolve(
                [...shopSchemas.values()].find(
                    (schema) =>
                        schema.getProps().target.isEmployee() &&
                        schema.getProps().target.getId() === employeeId,
                ) ?? null,
            ),
        findByDepartment: (departmentId) =>
            Promise.resolve(
                [...shopSchemas.values()].find(
                    (schema) =>
                        schema.getProps().target.isDepartment() &&
                        schema.getProps().target.getId() === departmentId,
                ) ?? null,
            ),
        findByEmployees: (employeeIds) =>
            Promise.resolve(
                employeeIds
                    .map((id) => shopSchemas.get(id))
                    .filter(
                        (schema): schema is ShopMotivationSchema => !!schema,
                    ),
            ),
        findAllEmployeeTargets: () =>
            Promise.resolve(
                [...shopSchemas.values()].filter((schema) =>
                    schema.getProps().target.isEmployee(),
                ),
            ),
        findAllDepartmentTargets: () =>
            Promise.resolve(
                [...shopSchemas.values()].filter((schema) =>
                    schema.getProps().target.isDepartment(),
                ),
            ),
        findIdByTarget: () => Promise.resolve(null),
        // Не используется этим e2e-тестом (он проверяет только отчёт по
        // зарплате, а не страницу просмотра/редактирования схем) —
        // добавлены исключительно ради соответствия интерфейсу порта.
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
    const fakeShopAccountingPeriodRepo: ShopAccountingPeriodRepositoryPort = {
        findByPeriod: () => Promise.resolve(null),
        save: () => Promise.resolve(),
    };
    const fakeShopAccountingPeriodSnapshot: ShopAccountingPeriodSnapshotPort = {
        saveAll: () => Promise.resolve(),
        findByKey: () => Promise.resolve(null),
        findManyByKey: () => Promise.resolve(new Map()),
        deleteByPeriod: () => Promise.resolve(),
    };
    const fakeShopAccountingCalculationCache: ShopAccountingCalculationCachePort =
        {
            find: () => Promise.resolve(null),
            upsert: () => Promise.resolve(),
            deleteByPeriod: () => Promise.resolve(),
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
    // hoursWorked: 5 — вместе с price 300 у схемы ниже даёт total 1500,
    // намеренно отличное от 2000 (8ч × 250) сервисного e2e-зеркала: числа
    // не должны совпадать, иначе равенство total между направлениями ничего
    // бы не доказывало о том, что каждое направление считает СВОЁ правило.
    //
    // employeeId 43 — отдельный сотрудник (см. describe ниже,
    // "ProductSold/FloatPercent по категории"), с отделом (departmentId 100)
    // и позицией отгрузки в категории 'root-folder' — остальные employeeId
    // (42, 999) продолжают получать null/[]/5 как раньше, эти два теста не
    // должны видеть данные друг друга.
    const fakeShopCalculationData: ShopCalculationDataPort = {
        findEmployeeIdentities: (employeeId) =>
            Promise.resolve(
                employeeId === 43
                    ? [
                          {
                              system: 'MOY_SKLAD',
                              identifierType: 'EMPLOYEE_ID',
                              externalId: 'employee-43',
                          },
                      ]
                    : [],
            ),
        findHoursWorked: () => Promise.resolve({ fact: 5, prognose: 5 }),
        findProductSoldItems: () =>
            Promise.resolve([
                {
                    positionId: 'shop-pos-1',
                    demandId: 'shop-demand-1',
                    itemName: 'Товар shop-pos-1',
                    demandLabel: 'shop-demand-1-label',
                    folderId: 'root-folder',
                    quantity: 1,
                    sum: 1000,
                    profit: 400,
                    onlineManagerId: 'employee-43',
                    offlineManagerId: null,
                    onlinePurchaserId: null,
                    offlinePurchaserId: null,
                },
            ]),
        findConfirmedTaskCompletions: () => Promise.resolve([]),
        findEmployeeDepartmentId: (employeeId) =>
            Promise.resolve(employeeId === 43 ? 100 : null),
        findEmployeesInDepartment: () => Promise.resolve([]),
        findEmployeeIdentitiesForEmployees: () => Promise.resolve(new Map()),
        findHoursWorkedForEmployees: () => Promise.resolve(new Map()),
        resolveCategoryDescendantFolderIds: (categoryIds) =>
            Promise.resolve(
                categoryIds.reduce<Record<string, string[]>>((acc, id) => {
                    acc[id] = [id];
                    return acc;
                }, {}),
            ),
    };

    // Фейковый ShopSalesPerformance, отдающий заданный percentCompletion и
    // на getFact(), и на getPrognose() — этому e2e важен только процент
    // выполнения плана (вход FloatPercent), не сами обороты/маржу.
    const buildFakeShopSalesPerformance = (
        percentCompletion: number,
        department: number,
        category: string | null,
    ): ShopSalesPerformance =>
        ({
            getPeriod: () => '2026-08',
            getDepartment: () => department,
            getCategory: () => category,
            getPlan: () => ({
                turnover: 1000,
                margin: 400,
                status: 'APPROVED',
            }),
            getFact: () => ({
                getTurnover: () => 1000,
                getMargin: () => 400,
                getPercentCompletion: () => percentCompletion,
            }),
            getPrognose: () => ({
                getTurnover: () => 1000,
                getMargin: () => 400,
                getPercentCompletion: () => percentCompletion,
            }),
        }) as unknown as ShopSalesPerformance;

    // Отдел 100 выполнен всего на 40% целиком, но категория 'root-folder'
    // (та самая, на которую заведено правило employeeId 43 ниже) — на 90%:
    // заведомо разные значения по разным ключам карты
    // salesPerformanceByCategory, чтобы e2e-тест мог отличить "правило
    // считает по своей категории" от "правило по-прежнему считает по отделу
    // целиком".
    const fakeShopSalesPerformanceReader: ShopSalesPerformanceReaderPort = {
        listForPeriod: () => Promise.resolve([]),
        findForScope: (_period, department, category) => {
            if (department !== 100) {
                return Promise.resolve(null);
            }
            if (category === 'root-folder') {
                return Promise.resolve(
                    buildFakeShopSalesPerformance(90, department, category),
                );
            }
            if (category === null) {
                return Promise.resolve(
                    buildFakeShopSalesPerformance(40, department, category),
                );
            }
            return Promise.resolve(null);
        },
        listForDepartment: async (period, department) => {
            const whole = await fakeShopSalesPerformanceReader.findForScope(
                period,
                department,
                null,
            );
            return whole ? [whole] : [];
        },
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

        // employeeId 43 — ProductSold/FloatPercent на категорию 'root-folder'
        // (см. describe ниже, "ProductSold/FloatPercent по категории").
        const shopSchemaProductSold = withRequestContext(() => {
            const rule = ProductSoldEntity.create({
                type: 'ProductSold',
                name: 'За технику (категория)',
                targetRole: 'ONLINE_MANAGER',
                config: {
                    category: 'root-folder',
                    award: {
                        type: 'FloatPercent',
                        basePercent: 10,
                        salaryBasis: 'REVENUE',
                        percentBorders: [
                            {
                                name: 'A',
                                fromPlanPercent: 50,
                                multiplier: 0.5,
                                mode: 'FIX',
                            },
                            {
                                name: 'B',
                                fromPlanPercent: 80,
                                multiplier: 1,
                                mode: 'FIX',
                            },
                            {
                                name: 'C',
                                fromPlanPercent: 100,
                                multiplier: 1.5,
                                mode: 'FIX',
                            },
                        ],
                    },
                },
            });
            return ShopMotivationSchema.create({
                targetType: 'Employee',
                targetId: 43,
                name: 'Продавец категории «Техника»',
                rules: [rule],
            });
        });
        shopSchemas.set(43, shopSchemaProductSold);

        const moduleRef = await Test.createTestingModule({
            // EventEmitterModule — EventEmitter2 для CloseShopAccountingPeriodHandler
            // (SalaryAccrualDocumentsCreatedDomainEvent, PRD 1); в приложении его
            // глобально даёт AppModule.
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
            .overrideProvider(SHOP_TASK_COMPLETION_REPOSITORY)
            .useValue(fakeShopTaskCompletionRepo)
            .overrideProvider(SHOP_CALCULATION_DATA)
            .useValue(fakeShopCalculationData)
            .overrideProvider(SHOP_ACCOUNTING_PERIOD_REPOSITORY)
            .useValue(fakeShopAccountingPeriodRepo)
            .overrideProvider(SHOP_ACCOUNTING_PERIOD_SNAPSHOT)
            .useValue(fakeShopAccountingPeriodSnapshot)
            .overrideProvider(SHOP_ACCOUNTING_CALCULATION_CACHE)
            .useValue(fakeShopAccountingCalculationCache)
            .overrideProvider(DOMAIN_SYNC_STATUS)
            .useValue(fakeDomainSyncStatus)
            .overrideProvider(SHOP_SALES_PLAN_REPOSITORY)
            .useValue(fakeSalesPlanRepo)
            .overrideProvider(SHOP_SALES_PERFORMANCE_READER)
            .useValue(fakeShopSalesPerformanceReader)
            .compile();

        app = moduleRef.createNestApplication();
        // Доменные исключения читают RequestContext в конструкторе — см. тот
        // же приём в сервисном e2e-зеркале.
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
            salesPerformance: [],
            isPlanApproved: true,
            accrualStatus: null,
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

    // Фаза 2 плана shop-sales-performance-by-category (issue #60):
    // ProductSold/FloatPercent должен читать percentCompletion СВОЕЙ
    // категории, а не отдела целиком.
    describe('ProductSold/FloatPercent по категории', () => {
        it('считает вознаграждение по проценту выполнения плана категории правила, а не по проценту отдела целиком', async () => {
            const response = await request(app.getHttpServer())
                .get('/v1/shop/accounting/salary_report/employee/43/2026-08')
                .expect(200);
            const body = response.body as EmployeeSalaryReportResponse;

            // Отдел (category: null) выполнен всего на 40% — при этом
            // проценте FloatPercent ниже нижнего порога (50) дал бы
            // множитель 0 и amount 0 (FloatPercentSchedule.resolveMultiplier).
            // Категория правила 'root-folder' выполнена на 90% — между
            // порогами B (80, ×1) и C (100, ×1.5), режим FIX держит
            // множитель предыдущего порога (×1): 1000 * 10% * 1 = 100.
            // Итог 100 (а не 0) доказывает, что расчёт берёт процент СВОЕЙ
            // категории правила, а не отдела целиком.
            expect(body.total).toEqual({ fact: 100, prognose: 100 });
            expect(body.rules).toEqual([
                expect.objectContaining({
                    type: 'ProductSold',
                    name: 'За технику (категория)',
                    amount: { fact: 100, prognose: 100 },
                }),
            ]);
            // Блок SalesPerformance в ответе — компактная сводка по отделу
            // целиком (category: null, см. to-sales-performance-summary.ts),
            // поэтому здесь ожидаемо 40%, а не 90% процента категории —
            // сводка отчёта и расчёт FloatPercent намеренно читают разные
            // записи карты salesPerformanceByCategory.
            expect(body.salesPerformance).toEqual([
                expect.objectContaining({
                    department: 100,
                    percentCompletion: 40,
                }),
            ]);
        });
    });
});
