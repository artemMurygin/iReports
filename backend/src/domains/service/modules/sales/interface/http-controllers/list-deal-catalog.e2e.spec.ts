import type { Server } from 'http';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type {
    ListDealStagesResponse,
    ListDealManagersResponse,
    ListDealSourcesResponse,
    ListDealStageGroupsResponse,
    ListDealDeviceTypesResponse,
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
import { DealListStage } from '@/domains/service/modules/sales/domain/value-objects/deal-list-stage.value-object';
import { DealAssignee } from '@/domains/service/modules/sales/domain/value-objects/deal-assignee.value-object';
import { DealLeadSource } from '@/domains/service/modules/sales/domain/value-objects/deal-lead-source.value-object';
import { DealDeviceType } from '@/domains/service/modules/sales/domain/value-objects/deal-device-type.value-object';
import { DealStageGroup } from '@/domains/service/modules/sales/domain/value-objects/deal-stage-group.value-object';
import { DomainExceptionFilter } from '@/shared/exceptions';

// Тот же приём, что list-deals.e2e.spec.ts (см. комментарий там): поднимает
// SalesModule целиком через Nest TestingModule (реальные Controller →
// ListDealCatalogService → DealCatalogReaderPort), подменяя только границу
// с БД через DEAL_CATALOG_READER (и FUNNEL_DEAL_REPOSITORY — тоже провайдер
// SalesModule, но не участвует в сценариях этого файла). Проверяет паритет
// формы ответа с легаси DealsController (src/TODO/deals/deals.controller.ts,
// удалён этой фазой) — каждый эндпоинт отдаёт голый массив, без обёртки.
describe('GET /v1/service/sales/deals/{stages,managers,sources,stage-groups,models} (e2e)', () => {
    let app: INestApplication<Server>;

    let stages: DealListStage[] = [];
    let managers: DealAssignee[] = [];
    let sources: DealLeadSource[] = [];
    let stageGroups: DealStageGroup[] = [];
    let deviceTypes: DealDeviceType[] = [];

    const fakeLeadRepo: LeadRepositoryPort = {
        findModifiedSince: () => Promise.resolve([]),
    };

    const fakeFactSource: ServiceSalesFactSourcePort = {
        aggregate: () => Promise.resolve([]),
    };

    const fakePlanRepo: SalesPlanRepositoryPort = {
        insert: () => Promise.resolve(),
        update: () => Promise.resolve(),
        delete: () => Promise.resolve(),
        findById: () => Promise.resolve(null),
        findByIds: () => Promise.resolve([]),
        findByScope: () => Promise.resolve(null),
        findByDirectionAndPeriod: () => Promise.resolve([]),
    };

    const fakeTemplateRepo: SalesPlanTemplateRepositoryPort = {
        insert: () => Promise.resolve(),
        update: () => Promise.resolve(),
        findByScope: () => Promise.resolve(null),
        findAll: () => Promise.resolve([]),
    };

    const fakeDealListRepo: DealListRepositoryPort = {
        findByDateRange: () => Promise.resolve([]),
    };

    const fakeDealCatalogReader: DealCatalogReaderPort = {
        findStages: () => Promise.resolve(stages),
        findDeviceTypes: () => Promise.resolve(deviceTypes),
        findManagers: () => Promise.resolve(managers),
        findSources: () => Promise.resolve(sources),
        findStageGroups: () => Promise.resolve(stageGroups),
    };

    const fakeFunnelDealRepo: FunnelDealRepositoryPort = {
        findByFilter: () => Promise.resolve([]),
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
        stages = [];
        managers = [];
        sources = [];
        stageGroups = [];
        deviceTypes = [];
    });

    it('GET /v1/service/sales/deals/stages — отдаёт этапы плоским массивом, форма совпадает с легаси getStages()', async () => {
        stages = [
            new DealListStage({
                id: 'C1:WON',
                name: 'Сделка успешна',
                sort: 100,
                color: '#00ff00',
                systemType: 'SUCCESS',
                stageGroupId: 'grp-1',
                stageGroupName: 'Завершено',
            }),
        ];

        const response = await request(app.getHttpServer())
            .get('/v1/service/sales/deals/stages')
            .expect(200);

        const body = response.body as ListDealStagesResponse;
        expect(body).toEqual([
            {
                id: 'C1:WON',
                name: 'Сделка успешна',
                sort: 100,
                color: '#00ff00',
                systemType: 'SUCCESS',
                stageGroupId: 'grp-1',
                stageGroupName: 'Завершено',
            },
        ]);
    });

    it('GET /v1/service/sales/deals/managers — отдаёт менеджеров плоским массивом', async () => {
        managers = [
            new DealAssignee({ id: 42, firstName: 'Иван', lastName: 'Петров' }),
        ];

        const response = await request(app.getHttpServer())
            .get('/v1/service/sales/deals/managers')
            .expect(200);

        const body = response.body as ListDealManagersResponse;
        expect(body).toEqual([
            { id: 42, firstName: 'Иван', lastName: 'Петров' },
        ]);
    });

    it('GET /v1/service/sales/deals/sources — отдаёт источники плоским массивом', async () => {
        sources = [new DealLeadSource({ id: 7, name: 'Сайт' })];

        const response = await request(app.getHttpServer())
            .get('/v1/service/sales/deals/sources')
            .expect(200);

        const body = response.body as ListDealSourcesResponse;
        expect(body).toEqual([{ id: 7, name: 'Сайт' }]);
    });

    it('GET /v1/service/sales/deals/stage-groups — отдаёт группы этапов плоским массивом', async () => {
        stageGroups = [new DealStageGroup({ id: 'grp-1', name: 'Завершено' })];

        const response = await request(app.getHttpServer())
            .get('/v1/service/sales/deals/stage-groups')
            .expect(200);

        const body = response.body as ListDealStageGroupsResponse;
        expect(body).toEqual([{ id: 'grp-1', name: 'Завершено' }]);
    });

    it('GET /v1/service/sales/deals/models — отдаёт модели устройств плоским массивом (легаси getDeviceTypes())', async () => {
        deviceTypes = [new DealDeviceType({ id: 5, name: 'Смартфон' })];

        const response = await request(app.getHttpServer())
            .get('/v1/service/sales/deals/models')
            .expect(200);

        const body = response.body as ListDealDeviceTypesResponse;
        expect(body).toEqual([{ id: 5, name: 'Смартфон' }]);
    });

    it('пустые справочники отдают пустой массив, а не null/404', async () => {
        await request(app.getHttpServer())
            .get('/v1/service/sales/deals/stages')
            .expect(200, []);
        await request(app.getHttpServer())
            .get('/v1/service/sales/deals/managers')
            .expect(200, []);
        await request(app.getHttpServer())
            .get('/v1/service/sales/deals/sources')
            .expect(200, []);
        await request(app.getHttpServer())
            .get('/v1/service/sales/deals/stage-groups')
            .expect(200, []);
        await request(app.getHttpServer())
            .get('/v1/service/sales/deals/models')
            .expect(200, []);
    });
});
