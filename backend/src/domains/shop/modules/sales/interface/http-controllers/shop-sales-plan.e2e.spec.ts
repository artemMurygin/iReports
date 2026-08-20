import type { Server } from 'http';
import { Global, INestApplication, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type {
    SalesPlanResponse,
    SalesPlanTemplateResponse,
} from 'ireports-contracts';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { SALES_PLAN_TEMPLATE_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan-template.port';
import type { SalesPlanTemplateRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan-template.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity';
import { SalesPlanTemplate } from '@/domains/service/modules/sales/domain/entities/sales-plan-template.entity';
import { CreateSalesPlanHandler } from '@/domains/service/modules/sales/application/command/create-sales-plan.handler';
import { UpdateSalesPlanHandler } from '@/domains/service/modules/sales/application/command/update-sales-plan.handler';
import { DeleteSalesPlanHandler } from '@/domains/service/modules/sales/application/command/delete-sales-plan.handler';
import { ApproveSalesPlanHandler } from '@/domains/service/modules/sales/application/command/approve-sales-plan.handler';
import { PutSalesPlanTemplateHandler } from '@/domains/service/modules/sales/application/command/put-sales-plan-template.handler';
import { EnsureSalesPlansForPeriodService } from '@/domains/service/modules/sales/application/services/ensure-sales-plans-for-period.service';
import { ListSalesPlansService } from '@/domains/service/modules/sales/application/services/list-sales-plans.service';
import { ListSalesPlanTemplatesService } from '@/domains/service/modules/sales/application/services/list-sales-plan-templates.service';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';
import { CreateShopSalesPlanHttpController } from './create-shop-sales-plan.http.controller';
import { UpdateShopSalesPlanHttpController } from './update-shop-sales-plan.http.controller';
import { DeleteShopSalesPlanHttpController } from './delete-shop-sales-plan.http.controller';
import { ApproveShopSalesPlanHttpController } from './approve-shop-sales-plan.http.controller';
import { ListShopSalesPlansHttpController } from './list-shop-sales-plans.http.controller';
import { ListShopSalesPlanTemplatesHttpController } from './list-shop-sales-plan-templates.http.controller';
import { PutShopSalesPlanTemplateHttpController } from './put-shop-sales-plan-template.http.controller';

// Зеркало sales-plan.e2e.spec.ts (domains/service/modules/sales), но на
// /v1/shop/sales/plan* — этот срез домена shop диспатчит те же классы
// команд/хендлеров, что и service (CommandBus глобален на всё приложение,
// см. задачу, создавшую этот модуль), поэтому здесь поднимается локальный
// тестовый модуль с CqrsModule + новыми shop-контроллерами + теми же
// хендлерами/сервисами, что и SalesModule — ShopSalesModule целиком не
// импортируется: он ещё не регистрирует эти контроллеры/провайдеры (это
// сделает отдельный шаг воркфлоу), а собственный ShopSalesModule тянет за
// собой MoySklad-интеграцию и крон, не относящиеся к этому срезу.
describe('Shop SalesPlan/SalesPlanTemplate HTTP (e2e)', () => {
    let app: INestApplication<Server>;

    const plans = new Map<string, SalesPlan>();
    const templates = new Map<
        string,
        Awaited<ReturnType<SalesPlanTemplateRepositoryPort['findAll']>>[number]
    >();

    const fakePlanRepo: SalesPlanRepositoryPort = {
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
        findByScope: (direction, department, category, period) =>
            Promise.resolve(
                [...plans.values()].find(
                    (p) =>
                        p.direction === direction &&
                        p.department === department &&
                        p.category === category &&
                        p.period === period,
                ) ?? null,
            ),
        findByDirectionAndPeriod: (direction, period) =>
            Promise.resolve(
                [...plans.values()].filter(
                    (p) => p.direction === direction && p.period === period,
                ),
            ),
    };

    const fakeTemplateRepo: SalesPlanTemplateRepositoryPort = {
        insert: (entity) => {
            templates.set(entity.id, entity);
            return Promise.resolve();
        },
        update: (entity) => {
            templates.set(entity.id, entity);
            return Promise.resolve();
        },
        findByScope: (direction, department, category) =>
            Promise.resolve(
                [...templates.values()].find(
                    (t) =>
                        t.direction === direction &&
                        t.department === department &&
                        t.category === category,
                ) ?? null,
            ),
        findAll: (direction) =>
            Promise.resolve(
                [...templates.values()].filter(
                    (t) => !direction || t.direction === direction,
                ),
            ),
    };

    const fakeUnitOfWork: UnitOfWorkPort = {
        run: (work) => work(),
    };

    @Global()
    @Module({
        providers: [{ provide: UNIT_OF_WORK, useValue: fakeUnitOfWork }],
        exports: [UNIT_OF_WORK],
    })
    class FakeInfrastructureModule {}

    @Module({
        imports: [CqrsModule, FakeInfrastructureModule],
        controllers: [
            CreateShopSalesPlanHttpController,
            UpdateShopSalesPlanHttpController,
            DeleteShopSalesPlanHttpController,
            ApproveShopSalesPlanHttpController,
            ListShopSalesPlansHttpController,
            ListShopSalesPlanTemplatesHttpController,
            PutShopSalesPlanTemplateHttpController,
        ],
        providers: [
            { provide: SALES_PLAN_REPOSITORY, useValue: fakePlanRepo },
            {
                provide: SALES_PLAN_TEMPLATE_REPOSITORY,
                useValue: fakeTemplateRepo,
            },
            CreateSalesPlanHandler,
            UpdateSalesPlanHandler,
            DeleteSalesPlanHandler,
            ApproveSalesPlanHandler,
            PutSalesPlanTemplateHandler,
            EnsureSalesPlansForPeriodService,
            ListSalesPlansService,
            ListSalesPlanTemplatesService,
        ],
    })
    class ShopSalesTestModule {}

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [ShopSalesTestModule],
        }).compile();

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

    it('батч-создание: план направления shop заводится независимо от одноимённой строки направления service', async () => {
        const servicePlan = withRequestContext(() =>
            SalesPlan.create({
                direction: 'service',
                department: 5,
                period: '2026-09',
                turnover: 999,
                margin: 111,
                source: 'MANUAL',
            }),
        );
        plans.set(servicePlan.id, servicePlan);

        const createResponse = await request(app.getHttpServer())
            .post('/v1/shop/sales/plan')
            .send({
                department: 5,
                period: '2026-09',
                turnover: 500_000,
                margin: 100_000,
            })
            .expect(201);
        expect(createResponse.body).toMatchObject({
            direction: 'shop',
            department: 5,
        });

        const shopList = await request(app.getHttpServer())
            .get('/v1/shop/sales/plan')
            .query({ period: '2026-09' })
            .expect(200);
        expect(shopList.body).toHaveLength(1);
    });

    it('PATCH на план направления service через путь shop отклоняется как 404', async () => {
        const servicePlan = withRequestContext(() =>
            SalesPlan.create({
                direction: 'service',
                department: 1,
                period: '2026-10',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            }),
        );
        plans.set(servicePlan.id, servicePlan);

        await request(app.getHttpServer())
            .patch(`/v1/shop/sales/plan/${servicePlan.id}`)
            .send({ turnover: 1 })
            .expect(404);
    });

    it('DELETE на план направления service через путь shop отклоняется как 404', async () => {
        const servicePlan = withRequestContext(() =>
            SalesPlan.create({
                direction: 'service',
                department: 1,
                period: '2026-10',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            }),
        );
        plans.set(servicePlan.id, servicePlan);

        await request(app.getHttpServer())
            .delete(`/v1/shop/sales/plan/${servicePlan.id}`)
            .expect(404);

        // Строка не была удалена — 404 означает "не найдена для shop", а не
        // фактическое удаление.
        expect(plans.has(servicePlan.id)).toBe(true);
    });

    it('approve по ids через путь shop отклоняет весь запрос целиком, если среди id есть план направления service', async () => {
        const shopPlan = withRequestContext(() =>
            SalesPlan.create({
                direction: 'shop',
                department: 1,
                period: '2026-11',
                turnover: 1_000_000,
                margin: 200_000,
                source: 'MANUAL',
            }),
        );
        plans.set(shopPlan.id, shopPlan);

        const servicePlan = withRequestContext(() =>
            SalesPlan.create({
                direction: 'service',
                department: 2,
                period: '2026-11',
                turnover: 500_000,
                margin: 100_000,
                source: 'MANUAL',
            }),
        );
        plans.set(servicePlan.id, servicePlan);

        await request(app.getHttpServer())
            .post('/v1/shop/sales/plan/approve')
            .send({ ids: [shopPlan.id, servicePlan.id], approvedBy: 42 })
            .expect(404);

        // Ни один план не утверждён — ни свой (shop), ни чужой (service).
        expect(plans.get(shopPlan.id)?.status).toBe('CREATED');
        expect(plans.get(servicePlan.id)?.status).toBe('CREATED');
    });

    it('утверждает весь месяц направления shop одним запросом, не трогая направление service', async () => {
        await request(app.getHttpServer())
            .post('/v1/shop/sales/plan')
            .send({
                department: 1,
                period: '2026-12',
                turnover: 100,
                margin: 10,
            })
            .expect(201);

        const servicePlan = withRequestContext(() =>
            SalesPlan.create({
                direction: 'service',
                department: 1,
                period: '2026-12',
                turnover: 200,
                margin: 20,
                source: 'MANUAL',
            }),
        );
        plans.set(servicePlan.id, servicePlan);

        const approveResponse = await request(app.getHttpServer())
            .post('/v1/shop/sales/plan/approve')
            .send({ period: '2026-12', approvedBy: 1 })
            .expect(201);

        const body = approveResponse.body as SalesPlanResponse[];
        expect(body).toHaveLength(1);
        expect(body[0].direction).toBe('shop');
        expect(plans.get(servicePlan.id)?.status).toBe('CREATED');
    });

    it('ленивое достраивание: GET на пустой период заводит план направления shop из шаблона (Фаза 4)', async () => {
        const template = withRequestContext(() =>
            SalesPlanTemplate.create({
                direction: 'shop',
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
