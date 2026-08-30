import type { Server } from 'http';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type { SalesPerformanceResponse } from 'ireports-contracts';
import { DatabaseService } from '@/infrustructure/database/database.service';
import { ShopSalesModule } from '@/domains/shop/modules/sales/sales.module';
import { SHOP_SALES_PLAN_REPOSITORY } from '@/domains/shop/modules/sales/application/ports/sales-plan.port';
import type { ShopSalesPlanRepositoryPort } from '@/domains/shop/modules/sales/application/ports/sales-plan.port';
import { SHOP_SALES_PLAN_TEMPLATE_REPOSITORY } from '@/domains/shop/modules/sales/application/ports/sales-plan-template.port';
import type { ShopSalesPlanTemplateRepositoryPort } from '@/domains/shop/modules/sales/application/ports/sales-plan-template.port';
import { SHOP_SALES_FACT_SOURCE } from '@/domains/shop/modules/sales/application/ports/sales-fact-source.port';
import type { ShopSalesFactSourcePort } from '@/domains/shop/modules/sales/application/ports/sales-fact-source.port';
import { ShopSalesPlan } from '@/domains/shop/modules/sales/domain/entities/sales-plan.entity';
import { ShopSalesPlanTemplate } from '@/domains/shop/modules/sales/domain/entities/sales-plan-template.entity';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Зеркало sales-plan.e2e.spec.ts направления service (сценарий
// SalesPerformance), но для отдельного эндпоинта магазина — см.
// обоснование отдельного пути в config/app.routes.ts. С Фазы 7
// (docs/service-shop-boundary-violations-fix) план использует собственную,
// независимую от domains/service/modules/sales реализацию ShopSalesPlan/
// ShopSalesPlanTemplate.
describe('Shop SalesPerformance HTTP (e2e)', () => {
    let app: INestApplication<Server>;

    const plans = new Map<string, ShopSalesPlan>();
    const templates = new Map<string, ShopSalesPlanTemplate>();
    let erpFacts: Awaited<ReturnType<ShopSalesFactSourcePort['aggregate']>> =
        [];

    const fakeFactSource: ShopSalesFactSourcePort = {
        aggregate: () => Promise.resolve(erpFacts),
    };

    const fakePlanRepo: ShopSalesPlanRepositoryPort = {
        insert: (entity) => {
            plans.set(entity.id, entity);
            return Promise.resolve();
        },
        update: (entity) => {
            plans.set(entity.id, entity);
            return Promise.resolve();
        },
        delete: (id) => {
            plans.delete(id);
            return Promise.resolve();
        },
        findById: (id) => Promise.resolve(plans.get(id) ?? null),
        findByIds: (ids) =>
            Promise.resolve(
                [...plans.values()].filter((p) => ids.includes(p.id)),
            ),
        findByScope: (department, category, period) =>
            Promise.resolve(
                [...plans.values()].find(
                    (p) =>
                        p.department === department &&
                        p.category === category &&
                        p.period === period,
                ) ?? null,
            ),
        findByPeriod: (period) =>
            Promise.resolve(
                [...plans.values()].filter((p) => p.period === period),
            ),
    };

    const fakeTemplateRepo: ShopSalesPlanTemplateRepositoryPort = {
        insert: (entity) => {
            templates.set(entity.id, entity);
            return Promise.resolve();
        },
        update: (entity) => {
            templates.set(entity.id, entity);
            return Promise.resolve();
        },
        findByScope: (department, category) =>
            Promise.resolve(
                [...templates.values()].find(
                    (t) =>
                        t.department === department && t.category === category,
                ) ?? null,
            ),
        findAll: () => Promise.resolve([...templates.values()]),
    };

    // ShopSalesModule теперь импортирует MoySkladSyncModule (Фаза 1,
    // docs/shop-sales-performance-by-category — источник
    // ProductFolderTreeService для раскрытия категории в
    // MoySkladSalesFactSourceRepository), чьи провайдеры
    // (ProductFolderTreeService, MoySkladSyncService и т.п.) конструируют
    // DatabaseService в конструкторе, даже когда SHOP_SALES_FACT_SOURCE сам
    // подменён фейком ниже — тот же приём фейкового DatabaseService, что и в
    // get-employee-salary-report.e2e.spec.ts.
    const fakeDatabaseService = {} as unknown as DatabaseService;

    // CreateShopSalesPlanHandler (провайдер ShopSalesModule, Фаза 7
    // docs/service-shop-boundary-violations-fix) требует UNIT_OF_WORK, даже
    // когда этот e2e не вызывает POST /plan напрямую — провайдер
    // инстанцируется на старте модуля.
    const fakeUnitOfWork: UnitOfWorkPort = { run: (work) => work() };

    @Global()
    @Module({
        providers: [
            { provide: DatabaseService, useValue: fakeDatabaseService },
            { provide: UNIT_OF_WORK, useValue: fakeUnitOfWork },
        ],
        exports: [DatabaseService, UNIT_OF_WORK],
    })
    class FakeInfrastructureModule {}

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [FakeInfrastructureModule, ShopSalesModule],
        })
            .overrideProvider(SHOP_SALES_PLAN_REPOSITORY)
            .useValue(fakePlanRepo)
            .overrideProvider(SHOP_SALES_PLAN_TEMPLATE_REPOSITORY)
            .useValue(fakeTemplateRepo)
            .overrideProvider(SHOP_SALES_FACT_SOURCE)
            .useValue(fakeFactSource)
            .compile();

        app = moduleRef.createNestApplication();
        app.use((req: unknown, res: unknown, next: () => void) =>
            new RequestContextMiddleware().use(req, res, next),
        );
        app.useGlobalFilters(new DomainExceptionFilter());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        plans.clear();
        templates.clear();
        erpFacts = [];
    });

    it('план, факт и прогноз одним запросом; margin равен ERP-агрегату, а не turnover - cost', async () => {
        const plan = withRequestContext(() =>
            ShopSalesPlan.create({
                department: 1,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            }),
        );
        plans.set(plan.id, plan);
        erpFacts = [
            {
                department: 1,
                category: null,
                turnover: 400_000,
                cost: 240_000,
                margin: 130_000, // != turnover - cost (160_000)
                quantity: 10,
            },
        ];

        const listResponse = await request(app.getHttpServer())
            .get('/v1/shop/sales/salesPerformance/2026-08')
            .expect(200);
        const performances = listResponse.body as SalesPerformanceResponse[];

        expect(performances).toHaveLength(1);
        expect(performances[0]).toMatchObject({
            direction: 'shop',
            period: '2026-08',
            department: 1,
            category: null,
            plan: { status: 'CREATED', turnover: 1_000_000 },
            fact: {
                turnover: 400_000,
                cost: 240_000,
                margin: 130_000,
                percentCompletion: 40,
            },
        });
    });

    // Фаза 1 (docs/shop-sales-performance-by-category): план с category
    // должен получить непустой факт, когда в ERP-агрегате есть бакет с той
    // же category (сама фейковая factSource раскрытие дерева не
    // выполняет — это ответственность MoySkladSalesFactSourceRepository,
    // покрытая отдельным unit-тестом; здесь важно, что
    // GetShopSalesPerformanceService и HTTP-слой корректно доносят
    // categoryIds/факт по категории до ответа).
    it('план с category: fact.turnover/percentCompletion не равны нулю при наличии продаж по этой категории', async () => {
        const plan = withRequestContext(() =>
            ShopSalesPlan.create({
                department: 1,
                category: 'folder-phones',
                period: '2026-09',
                turnover: 200_000,
                margin: 40_000,
                source: 'MANUAL',
            }),
        );
        plans.set(plan.id, plan);
        erpFacts = [
            {
                department: 1,
                category: 'folder-phones',
                turnover: 100_000,
                cost: 60_000,
                margin: 30_000,
                quantity: 4,
            },
        ];

        const listResponse = await request(app.getHttpServer())
            .get('/v1/shop/sales/salesPerformance/2026-09')
            .expect(200);
        const performances = listResponse.body as SalesPerformanceResponse[];

        expect(performances).toHaveLength(1);
        expect(performances[0]).toMatchObject({
            department: 1,
            category: 'folder-phones',
            fact: {
                turnover: 100_000,
                margin: 30_000,
                percentCompletion: 50,
            },
        });
        expect(performances[0].fact.turnover).not.toBe(0);
        expect(performances[0].fact.percentCompletion).not.toBe(0);
    });

    it('ленивое достраивание: GET на пустой период магазина заводит план из шаблона', async () => {
        const template = ShopSalesPlanTemplate.create({
            department: 5,
            turnover: 300_000,
            margin: 50_000,
            growthPercent: 10,
        });
        templates.set(template.id, template);

        const listResponse = await request(app.getHttpServer())
            .get('/v1/shop/sales/salesPerformance/2026-11')
            .expect(200);
        const performances = listResponse.body as SalesPerformanceResponse[];

        expect(performances).toHaveLength(1);
        expect(performances[0]).toMatchObject({
            direction: 'shop',
            department: 5,
            plan: { source: 'TEMPLATE', turnover: 300_000 },
        });
    });
});
