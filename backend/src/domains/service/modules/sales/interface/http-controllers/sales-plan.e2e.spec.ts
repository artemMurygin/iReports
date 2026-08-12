import type { Server } from 'http';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type {
    SalesPerformanceResponse,
    SalesPlanResponse,
    SalesPlanTemplateResponse,
} from 'ireports-contracts';
import { SalesModule } from '@/domains/service/modules/sales/sales.module';
import { LEAD_REPOSITORY } from '@/domains/service/modules/sales/domain/ports/sales.repositories.port';
import type { LeadRepositoryPort } from '@/domains/service/modules/sales/domain/ports/sales.repositories.port';
import { SALES_PLAN_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import type { SalesPlanRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan.port';
import { SALES_PLAN_TEMPLATE_REPOSITORY } from '@/domains/service/modules/sales/application/ports/sales-plan-template.port';
import type { SalesPlanTemplateRepositoryPort } from '@/domains/service/modules/sales/application/ports/sales-plan-template.port';
import { SERVICE_SALES_FACT_SOURCE } from '@/domains/service/modules/sales/application/ports/service-sales-fact-source.port';
import type { ServiceSalesFactSourcePort } from '@/domains/service/modules/sales/application/ports/service-sales-fact-source.port';
import { DEAL_LIST_REPOSITORY } from '@/domains/service/modules/sales/application/ports/deal-list.port';
import type { DealListRepositoryPort } from '@/domains/service/modules/sales/application/ports/deal-list.port';
import { DEAL_CATALOG_READER } from '@/domains/service/modules/sales/application/ports/deal-catalog.port';
import type { DealCatalogReaderPort } from '@/domains/service/modules/sales/application/ports/deal-catalog.port';
import { FUNNEL_DEAL_REPOSITORY } from '@/domains/service/modules/sales/application/ports/funnel-deal.port';
import type { FunnelDealRepositoryPort } from '@/domains/service/modules/sales/application/ports/funnel-deal.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { SalesPlan } from '@/domains/service/modules/sales/domain/entities/sales-plan.entity';
import { SalesPlanTemplate } from '@/domains/service/modules/sales/domain/entities/sales-plan-template.entity';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { withRequestContext } from '@/shared/testing/with-request-context';

// Как и get-employee-salary-report.e2e.spec.ts (см. соседний accounting-
// модуль): поднимает SalesModule целиком через Nest TestingModule (реальные
// Controller → CommandBus/Service → Handler → Entity), подменяя только
// границу с БД — репозитории. LEAD_REPOSITORY подменяется заглушкой: он не
// участвует в сценариях этого теста, но реальная LeadRepository требует
// живого DatabaseService из @Global() DatabaseModule, который сюда не
// импортирован. SERVICE_SALES_FACT_SOURCE подменяется по той же причине —
// реальный RoappSalesFactSourceRepository тоже требует DatabaseService
// (Фаза 5).
describe('SalesPlan/SalesPlanTemplate/SalesPerformance HTTP (e2e)', () => {
    let app: INestApplication<Server>;

    const plans = new Map<string, SalesPlan>();
    const templates = new Map<string, SalesPlanTemplate>();
    let erpFacts: Awaited<ReturnType<ServiceSalesFactSourcePort['aggregate']>> =
        [];

    const fakeLeadRepo: LeadRepositoryPort = {
        findModifiedSince: () => Promise.resolve([]),
    };

    const fakeFactSource: ServiceSalesFactSourcePort = {
        aggregate: () => Promise.resolve(erpFacts),
    };

    // Сделки/лиды (GET /v1/service/sales/deals) не участвуют в сценариях
    // этого файла, но DEAL_LIST_REPOSITORY теперь тоже провайдер
    // SalesModule (см. sales.module.ts) — реальная DealListRepository
    // требует живой DatabaseService из @Global() DatabaseModule, который
    // сюда не импортирован, поэтому подменяется той же заглушкой, что и
    // остальные репозитории этого файла.
    const fakeDealListRepo: DealListRepositoryPort = {
        findByDateRange: () => Promise.resolve([]),
    };

    // Справочники сделок (GET /v1/service/sales/deals/{stages,managers,
    // sources,stage-groups,models}, Фаза 2) — та же причина подмены, что и
    // fakeDealListRepo выше: реальная DealCatalogRepository тоже требует
    // живой DatabaseService.
    const fakeDealCatalogReader: DealCatalogReaderPort = {
        findStages: () => Promise.resolve([]),
        findDeviceTypes: () => Promise.resolve([]),
        findManagers: () => Promise.resolve([]),
        findSources: () => Promise.resolve([]),
        findStageGroups: () => Promise.resolve([]),
    };

    // Отчёт по воронке (GET /v1/service/sales/funnel-report, Фаза 4) — тем
    // же приёмом, что и fakeDealListRepo выше: не участвует в сценариях
    // этого файла, но FUNNEL_DEAL_REPOSITORY тоже провайдер SalesModule.
    const fakeFunnelDealRepo: FunnelDealRepositoryPort = {
        findByFilter: () => Promise.resolve([]),
    };

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

    // CreateSalesPlanHandler (Фаза с batch-созданием) заворачивает вставку
    // строк в UNIT_OF_WORK — реальный PrismaUnitOfWork приходит из
    // @Global() DatabaseModule (требует живой Postgres), который сюда не
    // импортирован. Регистрируем фейк тем же способом (@Global()-модуль),
    // каким это в реальном приложении делает DatabaseModule — см. тот же
    // приём в get-employee-salary-report.e2e.spec.ts.
    const fakeUnitOfWork: UnitOfWorkPort = {
        run: (work) => work(),
    };

    @Global()
    @Module({
        providers: [{ provide: UNIT_OF_WORK, useValue: fakeUnitOfWork }],
        exports: [UNIT_OF_WORK],
    })
    class FakeInfrastructureModule {}

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [FakeInfrastructureModule, SalesModule],
        })
            .overrideProvider(LEAD_REPOSITORY)
            .useValue(fakeLeadRepo)
            .overrideProvider(SALES_PLAN_REPOSITORY)
            .useValue(fakePlanRepo)
            .overrideProvider(SALES_PLAN_TEMPLATE_REPOSITORY)
            .useValue(fakeTemplateRepo)
            .overrideProvider(SERVICE_SALES_FACT_SOURCE)
            .useValue(fakeFactSource)
            .overrideProvider(DEAL_LIST_REPOSITORY)
            .useValue(fakeDealListRepo)
            .overrideProvider(DEAL_CATALOG_READER)
            .useValue(fakeDealCatalogReader)
            .overrideProvider(FUNNEL_DEAL_REPOSITORY)
            .useValue(fakeFunnelDealRepo)
            .compile();

        app = moduleRef.createNestApplication();
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

    afterEach(() => {
        plans.clear();
        templates.clear();
        erpFacts = [];
    });

    it('заводит, читает, правит, утверждает и удаляет план месяца', async () => {
        const createResponse = await request(app.getHttpServer())
            .post('/v1/service/sales/plan')
            .send({
                department: 1,
                period: '2026-08',
                turnover: 1_000_000,
                margin: 200_000,
            })
            .expect(201);
        const created = createResponse.body as SalesPlanResponse;
        expect(created).toMatchObject({
            direction: 'service',
            department: 1,
            category: null,
            status: 'CREATED',
            source: 'MANUAL',
        });

        // Повторное создание на ту же комбинацию отклоняется.
        await request(app.getHttpServer())
            .post('/v1/service/sales/plan')
            .send({
                department: 1,
                period: '2026-08',
                turnover: 1,
                margin: 1,
            })
            .expect(409);

        const listResponse = await request(app.getHttpServer())
            .get('/v1/service/sales/plan')
            .query({ period: '2026-08' })
            .expect(200);
        expect(listResponse.body).toHaveLength(1);

        const approveResponse = await request(app.getHttpServer())
            .post('/v1/service/sales/plan/approve')
            .send({ ids: [created.id], approvedBy: 42 })
            .expect(201);
        expect((approveResponse.body as SalesPlanResponse[])[0].status).toBe(
            'APPROVED',
        );

        // Правка утверждённой строки возвращает её в CREATED + MANUAL.
        const updateResponse = await request(app.getHttpServer())
            .patch(`/v1/service/sales/plan/${created.id}`)
            .send({ turnover: 1_500_000 })
            .expect(200);
        expect(updateResponse.body).toMatchObject({
            status: 'CREATED',
            source: 'MANUAL',
            turnover: 1_500_000,
            approvedBy: null,
        });

        await request(app.getHttpServer())
            .delete(`/v1/service/sales/plan/${created.id}`)
            .expect(204);

        const afterDelete = await request(app.getHttpServer())
            .get('/v1/service/sales/plan')
            .query({ period: '2026-08' })
            .expect(200);
        expect(afterDelete.body).toHaveLength(0);
    });

    it('заводит несколько планов (отделов/категорий) одним batch-запросом', async () => {
        const createResponse = await request(app.getHttpServer())
            .post('/v1/service/sales/plan')
            .send({
                items: [
                    {
                        department: 1,
                        category: '10',
                        period: '2026-12',
                        turnover: 1_000_000,
                        margin: 200_000,
                    },
                    {
                        department: 2,
                        period: '2026-12',
                        turnover: 500_000,
                        margin: 100_000,
                    },
                ],
            })
            .expect(201);

        const created = createResponse.body as SalesPlanResponse[];
        expect(created).toHaveLength(2);
        expect(created).toMatchObject([
            { direction: 'service', department: 1, category: '10' },
            { direction: 'service', department: 2, category: null },
        ]);

        const listResponse = await request(app.getHttpServer())
            .get('/v1/service/sales/plan')
            .query({ period: '2026-12' })
            .expect(200);
        expect(listResponse.body).toHaveLength(2);
    });

    it('batch-запрос отклоняет строку, конфликтующую с уже существующим планом, — весь запрос падает без частичного создания', async () => {
        await request(app.getHttpServer())
            .post('/v1/service/sales/plan')
            .send({
                department: 3,
                period: '2027-01',
                turnover: 1,
                margin: 1,
            })
            .expect(201);

        // Конфликтующая строка стоит первой — до неё цикл в хендлере не
        // успевает дойти до отдела 4, так что фейковый (нетранзакционный)
        // репозиторий теста корректно отражает поведение реального
        // UNIT_OF_WORK: ничего лишнего не создаётся.
        await request(app.getHttpServer())
            .post('/v1/service/sales/plan')
            .send({
                items: [
                    {
                        department: 3,
                        period: '2027-01',
                        turnover: 3,
                        margin: 3,
                    },
                    {
                        department: 4,
                        period: '2027-01',
                        turnover: 2,
                        margin: 2,
                    },
                ],
            })
            .expect(409);

        const listResponse = await request(app.getHttpServer())
            .get('/v1/service/sales/plan')
            .query({ period: '2027-01' })
            .expect(200);
        expect(listResponse.body).toHaveLength(1);
        expect((listResponse.body as SalesPlanResponse[])[0].department).toBe(
            3,
        );
    });

    it('batch-запрос отклоняет дубли внутри самого запроса, не создавая ни одной строки', async () => {
        await request(app.getHttpServer())
            .post('/v1/service/sales/plan')
            .send({
                items: [
                    {
                        department: 5,
                        period: '2027-02',
                        turnover: 1,
                        margin: 1,
                    },
                    {
                        department: 5,
                        period: '2027-02',
                        turnover: 2,
                        margin: 2,
                    },
                ],
            })
            .expect(409);

        const listResponse = await request(app.getHttpServer())
            .get('/v1/service/sales/plan')
            .query({ period: '2027-02' })
            .expect(200);
        expect(listResponse.body).toHaveLength(0);
    });

    it('утверждает весь месяц одним запросом', async () => {
        await request(app.getHttpServer())
            .post('/v1/service/sales/plan')
            .send({
                department: 1,
                period: '2026-09',
                turnover: 100,
                margin: 10,
            })
            .expect(201);
        await request(app.getHttpServer())
            .post('/v1/service/sales/plan')
            .send({
                department: 2,
                period: '2026-09',
                turnover: 200,
                margin: 20,
            })
            .expect(201);

        const approveResponse = await request(app.getHttpServer())
            .post('/v1/service/sales/plan/approve')
            .send({ period: '2026-09', approvedBy: 1 })
            .expect(201);

        const body = approveResponse.body as SalesPlanResponse[];
        expect(body).toHaveLength(2);
        expect(body.every((p) => p.status === 'APPROVED')).toBe(true);
    });

    it('ленивое достраивание: GET на пустой период заводит план из шаблона и из плана предыдущего месяца (Фаза 4)', async () => {
        // Шаблон на отдел 2 — ни за какой месяц строки плана ещё нет.
        const template = SalesPlanTemplate.create({
            direction: 'service',
            department: 2,
            turnover: 300_000,
            margin: 50_000,
            growthPercent: 10,
        });
        templates.set(template.id, template);

        // План предыдущего месяца на отдел 1.
        const previous = SalesPlan.create({
            direction: 'service',
            department: 1,
            period: '2026-10',
            turnover: 1_000_000,
            margin: 200_000,
            source: 'MANUAL',
        });
        plans.set(previous.id, previous);

        const listResponse = await request(app.getHttpServer())
            .get('/v1/service/sales/plan')
            .query({ period: '2026-11' })
            .expect(200);

        const body = listResponse.body as SalesPlanResponse[];
        expect(body).toHaveLength(2);
        const byDepartment = new Map(
            body.map((plan) => [plan.department, plan]),
        );
        expect(byDepartment.get(1)).toMatchObject({
            source: 'PREVIOUS_MONTH',
            status: 'CREATED',
            turnover: 1_100_000,
            margin: 220_000,
        });
        expect(byDepartment.get(2)).toMatchObject({
            source: 'TEMPLATE',
            status: 'CREATED',
            turnover: 300_000,
            margin: 50_000,
        });

        // Повторное обращение к тому же периоду идемпотентно — не плодит
        // новых строк поверх уже достроенных.
        const secondResponse = await request(app.getHttpServer())
            .get('/v1/service/sales/plan')
            .query({ period: '2026-11' })
            .expect(200);
        expect(secondResponse.body).toHaveLength(2);
    });

    it('шаблон: PUT создаёт строку при первой правке и правит при повторной', async () => {
        const firstPut = await request(app.getHttpServer())
            .put('/v1/service/sales/plan_template')
            .send({
                department: 1,
                turnover: 1_000_000,
                margin: 200_000,
                growthPercent: 10,
            })
            .expect(200);
        const created = firstPut.body as SalesPlanTemplateResponse;
        expect(created.growthPercent).toBe(10);

        const secondPut = await request(app.getHttpServer())
            .put('/v1/service/sales/plan_template')
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
            .get('/v1/service/sales/plan_template')
            .expect(200);
        expect(listResponse.body).toHaveLength(1);
    });

    it('SalesPerformance: план, факт и прогноз одним запросом; правка/удаление плана видны сразу же (Фаза 5)', async () => {
        const plan = withRequestContext(() =>
            SalesPlan.create({
                direction: 'service',
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
                quantity: 10,
            },
        ];

        const listResponse = await request(app.getHttpServer())
            .get('/v1/service/sales/salesPerformance/2026-08')
            .query({ direction: 'service' })
            .expect(200);
        const performances = listResponse.body as SalesPerformanceResponse[];
        expect(performances).toHaveLength(1);
        expect(performances[0]).toMatchObject({
            direction: 'service',
            period: '2026-08',
            department: 1,
            category: null,
            plan: { status: 'CREATED', turnover: 1_000_000 },
            fact: {
                turnover: 400_000,
                cost: 240_000,
                margin: 160_000,
                percentCompletion: 40,
            },
        });

        // Правка плана меняет percentCompletion без изменения ERP-факта —
        // SalesFact/SalesPrognose не персистятся, пересчитываются заново.
        await request(app.getHttpServer())
            .patch(`/v1/service/sales/plan/${plan.id}`)
            .send({ turnover: 2_000_000 })
            .expect(200);

        const afterEdit = await request(app.getHttpServer())
            .get('/v1/service/sales/salesPerformance/2026-08')
            .query({ direction: 'service' })
            .expect(200);
        expect(
            (afterEdit.body as SalesPerformanceResponse[])[0].fact
                .percentCompletion,
        ).toBe(20);

        // Удаление плана удаляет факт и прогноз — строка пропадает из
        // ответа целиком.
        await request(app.getHttpServer())
            .delete(`/v1/service/sales/plan/${plan.id}`)
            .expect(204);

        const afterDelete = await request(app.getHttpServer())
            .get('/v1/service/sales/salesPerformance/2026-08')
            .query({ direction: 'service' })
            .expect(200);
        expect(afterDelete.body).toHaveLength(0);
    });

    it('SalesPerformance отклоняет направление shop в Фазе 5', async () => {
        await request(app.getHttpServer())
            .get('/v1/service/sales/salesPerformance/2026-08')
            .query({ direction: 'shop' })
            .expect(400);
    });

    // Фаза 2 (переход direction команд application/command из query/body в
    // обязательное поле, подставляемое контроллером): эндпоинты этого
    // модуля больше не обслуживают направление shop через один общий CRUD
    // (в отличие от Фазы 11, см. git-историю) — они висят под /v1/service и
    // всегда пишут direction: 'service'. Схема createSalesPlanRequestSchema
    // больше не содержит поле direction вообще — если клиент всё равно
    // пришлёт его в теле, zod молча отбрасывает незнакомое поле при
    // валидации, на результат не влияет.
    it('эндпоинт плана игнорирует direction, переданный в теле, и всегда пишет service', async () => {
        const createResponse = await request(app.getHttpServer())
            .post('/v1/service/sales/plan')
            .send({
                direction: 'shop',
                department: 9,
                period: '2026-08',
                turnover: 500_000,
                margin: 100_000,
            })
            .expect(201);
        expect((createResponse.body as SalesPlanResponse).direction).toBe(
            'service',
        );

        const listResponse = await request(app.getHttpServer())
            .get('/v1/service/sales/plan')
            .query({ period: '2026-08' })
            .expect(200);
        expect(listResponse.body).toMatchObject([{ direction: 'service' }]);
    });

    it('эндпоинт шаблона плана игнорирует direction, переданный в теле, и всегда пишет service', async () => {
        const templatePut = await request(app.getHttpServer())
            .put('/v1/service/sales/plan_template')
            .send({
                direction: 'shop',
                department: 2,
                turnover: 300_000,
                margin: 60_000,
                growthPercent: 15,
            })
            .expect(200);
        expect(templatePut.body).toMatchObject({
            direction: 'service',
            department: 2,
            growthPercent: 15,
        });
    });
});
