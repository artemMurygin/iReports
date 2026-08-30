import type { Server } from 'http';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type {
    SalesPlanResponse,
    SalesPlanTemplateResponse,
} from 'ireports-contracts';
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

// Зеркало sales-plan.e2e.spec.ts направления service, но на
// /v1/shop/sales/plan* — с Фазы 7 (docs/service-shop-boundary-violations-fix)
// этот срез домена shop использует собственные, независимые от
// domains/service/modules/sales классы команд/хендлеров/сущностей
// (ShopSalesPlan/ShopSalesPlanTemplate), поэтому здесь поднимается реальный
// ShopSalesModule целиком, с фейковыми репозиториями плана/шаблона вместо
// Prisma. Изоляция от направления service больше не проверяется общим
// фейковым хранилищем с полем direction (у ShopSalesPlan такого поля нет
// вовсе, см. WHY в entity) — она теперь структурная: разные Entity/Port/
// Repository-классы домена, разные CQRS-команды, поэтому и представить
// "план направления service" в этом фейковом хранилище физически
// невозможно.
describe('Shop SalesPlan/SalesPlanTemplate HTTP (e2e)', () => {
    let app: INestApplication<Server>;

    const plans = new Map<string, ShopSalesPlan>();
    const templates = new Map<string, ShopSalesPlanTemplate>();

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

    const fakeFactSource: ShopSalesFactSourcePort = {
        aggregate: () => Promise.resolve([]),
    };

    // ShopSalesModule импортирует MoySkladSyncModule (Фаза 1,
    // docs/shop-sales-performance-by-category), чьи провайдеры конструируют
    // DatabaseService в конструкторе — тот же приём фейкового
    // DatabaseService, что и в sales-performance.e2e.spec.ts.
    const fakeDatabaseService = {} as unknown as DatabaseService;

    // CreateShopSalesPlanHandler (провайдер ShopSalesModule) требует
    // UNIT_OF_WORK — фейковая реализация без реальной транзакции, тот же
    // приём, что и в sales-plan.e2e.spec.ts направления service.
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
    });

    it('заводит, читает, правит, утверждает и удаляет план месяца направления shop', async () => {
        const createResponse = await request(app.getHttpServer())
            .post('/v1/shop/sales/plan')
            .send({
                department: 1,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
            })
            .expect(201);
        const created = createResponse.body as SalesPlanResponse;
        expect(created).toMatchObject({
            direction: 'shop',
            department: 1,
            category: null,
            status: 'CREATED',
            source: 'MANUAL',
        });

        await request(app.getHttpServer())
            .post('/v1/shop/sales/plan')
            .send({
                department: 1,
                period: '2026-08',
                turnover: 1,
                margin: 1,
            })
            .expect(409);

        const listResponse = await request(app.getHttpServer())
            .get('/v1/shop/sales/plan')
            .query({ period: '2026-08' })
            .expect(200);
        expect(listResponse.body).toHaveLength(1);

        const approveResponse = await request(app.getHttpServer())
            .post('/v1/shop/sales/plan/approve')
            .send({ ids: [created.id], approvedBy: 42 })
            .expect(201);
        expect((approveResponse.body as SalesPlanResponse[])[0].status).toBe(
            'APPROVED',
        );

        const updateResponse = await request(app.getHttpServer())
            .patch(`/v1/shop/sales/plan/${created.id}`)
            .send({ turnover: 1_500_000 })
            .expect(200);
        expect(updateResponse.body).toMatchObject({
            status: 'CREATED',
            source: 'MANUAL',
            turnover: 1_500_000,
            approvedBy: null,
        });

        await request(app.getHttpServer())
            .delete(`/v1/shop/sales/plan/${created.id}`)
            .expect(204);

        const afterDelete = await request(app.getHttpServer())
            .get('/v1/shop/sales/plan')
            .query({ period: '2026-08' })
            .expect(200);
        expect(afterDelete.body).toHaveLength(0);
    });

    it('PATCH на неизвестный id отклоняется как 404', async () => {
        await request(app.getHttpServer())
            .patch('/v1/shop/sales/plan/00000000-0000-0000-0000-000000000000')
            .send({ turnover: 1 })
            .expect(404);
    });

    it('DELETE на неизвестный id отклоняется как 404, ничего не удаляя', async () => {
        const plan = withRequestContext(() =>
            ShopSalesPlan.create({
                department: 1,
                period: '2026-10',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            }),
        );
        plans.set(plan.id, plan);

        await request(app.getHttpServer())
            .delete('/v1/shop/sales/plan/00000000-0000-0000-0000-000000000000')
            .expect(404);

        // Существующий план не был затронут — 404 означает "не найден
        // именно этот id", а не что-то удалилось по ошибке.
        expect(plans.has(plan.id)).toBe(true);
    });

    it('approve по ids отклоняет весь запрос целиком, если хотя бы один id не найден', async () => {
        const plan = withRequestContext(() =>
            ShopSalesPlan.create({
                department: 1,
                period: '2026-11',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            }),
        );
        plans.set(plan.id, plan);

        await request(app.getHttpServer())
            .post('/v1/shop/sales/plan/approve')
            .send({
                ids: [plan.id, '00000000-0000-0000-0000-000000000000'],
                approvedBy: 42,
            })
            .expect(404);

        // Ни один план не утверждён — запрос отклонён целиком.
        expect(plans.get(plan.id)?.status).toBe('CREATED');
    });

    it('утверждает весь месяц одним запросом', async () => {
        await request(app.getHttpServer())
            .post('/v1/shop/sales/plan')
            .send({
                department: 1,
                period: '2026-12',
                turnover: 100,
                margin: 10,
            })
            .expect(201);

        const approveResponse = await request(app.getHttpServer())
            .post('/v1/shop/sales/plan/approve')
            .send({ period: '2026-12', approvedBy: 1 })
            .expect(201);

        const body = approveResponse.body as SalesPlanResponse[];
        expect(body).toHaveLength(1);
        expect(body[0].direction).toBe('shop');
        expect(body[0].status).toBe('APPROVED');
    });

    it('ленивое достраивание: GET на пустой период заводит план направления shop из шаблона (Фаза 4)', async () => {
        const template = withRequestContext(() =>
            ShopSalesPlanTemplate.create({
                department: 3,
                turnover: 300_000,
                margin: 50_000,
                growthPercent: 10,
            }),
        );
        templates.set(template.id, template);

        const listResponse = await request(app.getHttpServer())
            .get('/v1/shop/sales/plan')
            .query({ period: '2027-01' })
            .expect(200);

        const body = listResponse.body as SalesPlanResponse[];
        expect(body).toHaveLength(1);
        expect(body[0]).toMatchObject({
            direction: 'shop',
            department: 3,
            source: 'TEMPLATE',
            status: 'CREATED',
            turnover: 300_000,
            margin: 50_000,
        });
    });

    it('шаблон: PUT создаёт строку направления shop при первой правке и правит при повторной, без query direction', async () => {
        const firstPut = await request(app.getHttpServer())
            .put('/v1/shop/sales/plan_template')
            .send({
                department: 1,
                turnover: 1_000_000,
                margin: 200_000,
                growthPercent: 10,
            })
            .expect(200);
        const created = firstPut.body as SalesPlanTemplateResponse;
        expect(created).toMatchObject({ direction: 'shop', growthPercent: 10 });

        const secondPut = await request(app.getHttpServer())
            .put('/v1/shop/sales/plan_template')
            .send({
                department: 1,
                turnover: 1_100_000,
                margin: 220_000,
                growthPercent: 12,
            })
            .expect(200);
        const updated = secondPut.body as SalesPlanTemplateResponse;
        expect(updated.id).toBe(created.id);
        expect(updated.growthPercent).toBe(12);

        const listResponse = await request(app.getHttpServer())
            .get('/v1/shop/sales/plan_template')
            .expect(200);
        expect(listResponse.body).toHaveLength(1);
    });
});
