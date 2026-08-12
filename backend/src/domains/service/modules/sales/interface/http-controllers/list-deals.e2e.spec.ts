import type { Server } from 'http';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type { ListDealsResponse } from 'ireports-contracts';
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
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { DateRange } from '@/shared/domain/date-range.value-object';
import { DealListItemEntity } from '@/domains/service/modules/sales/domain/entities/deal-list-item.entity';
import { DealListStage } from '@/domains/service/modules/sales/domain/value-objects/deal-list-stage.value-object';
import { DealAssignee } from '@/domains/service/modules/sales/domain/value-objects/deal-assignee.value-object';
import { DealPointOfContact } from '@/domains/service/modules/sales/domain/value-objects/deal-point-of-contact.value-object';
import { DealLeadSource } from '@/domains/service/modules/sales/domain/value-objects/deal-lead-source.value-object';
import { DealBrand } from '@/domains/service/modules/sales/domain/value-objects/deal-brand.value-object';
import { DealDeviceType } from '@/domains/service/modules/sales/domain/value-objects/deal-device-type.value-object';
import { DomainExceptionFilter } from '@/shared/exceptions';

// Тот же приём, что sales-plan.e2e.spec.ts (см. комментарий там): поднимает
// SalesModule целиком через Nest TestingModule (реальные Controller →
// ListDealsService → DealListRepositoryPort), подменяя только границу с БД.
// LEAD_REPOSITORY/SALES_PLAN_REPOSITORY/SALES_PLAN_TEMPLATE_REPOSITORY/
// SERVICE_SALES_FACT_SOURCE подменяются заглушками по той же причине, что и
// там — они не участвуют в сценариях этого файла, но реальные реализации
// требуют живого DatabaseService из @Global() DatabaseModule, который сюда
// не импортирован. DEAL_LIST_REPOSITORY подменяется управляемым фейком,
// реализующим DealListRepositoryPort (возвращает доменные сущности, а не
// сырые Prisma-строки — граница подмены находится на уровне порта,
// инжектируемого в ListDealsService, а не на уровне БД).
describe('GET /v1/service/sales/deals (e2e)', () => {
    let app: INestApplication<Server>;

    let seededDeals: DealListItemEntity[] = [];
    let capturedRange: DateRange | null = null;

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
        findByDateRange: (range) => {
            capturedRange = range;
            return Promise.resolve(seededDeals);
        },
    };

    // Справочники сделок (Фаза 2) не участвуют в сценариях этого файла, но
    // DEAL_CATALOG_READER теперь тоже провайдер SalesModule (см.
    // sales.module.ts) — реальная DealCatalogRepository требует живой
    // DatabaseService из @Global() DatabaseModule, который сюда не
    // импортирован, поэтому подменяется заглушкой, как и остальные порты
    // этого файла.
    const fakeDealCatalogReader: DealCatalogReaderPort = {
        findStages: () => Promise.resolve([]),
        findDeviceTypes: () => Promise.resolve([]),
        findManagers: () => Promise.resolve([]),
        findSources: () => Promise.resolve([]),
        findStageGroups: () => Promise.resolve([]),
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
        seededDeals = [];
        capturedRange = null;
    });

    // Строит DealListItemEntity ровно так, как это делал бы реальный
    // DealListItemMapper.toDomain из строки bitrix_deals (см.
    // infrastructure/mappers/deal-list-item.mapper.ts) — граница фейка
    // находится на уровне доменных сущностей/VO, а не сырых Prisma-строк.
    function buildDeal(overrides: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
    }): DealListItemEntity {
        return new DealListItemEntity({
            id: overrides.id,
            createdAt: overrides.createdAt,
            updatedAt: overrides.updatedAt,
            props: {
                title: 'Ремонт iPhone 13',
                opportunity: 15_000,
                categoryId: 0,
                deviceModel: 'iPhone 13',
                deviceMalfunction: 'Не включается',
                stage: new DealListStage({
                    id: 'C1:WON',
                    name: 'Сделка успешна',
                    sort: 100,
                    color: '#00ff00',
                    systemType: 'SUCCESS',
                    stageGroupId: 'grp-1',
                    stageGroupName: 'Завершено',
                }),
                assignedBy: new DealAssignee({
                    id: 42,
                    firstName: 'Иван',
                    lastName: 'Петров',
                }),
                pointOfContact: new DealPointOfContact({
                    id: 'poc-1',
                    name: 'Клиент',
                    sort: 1,
                }),
                leadSource: new DealLeadSource({
                    id: 7,
                    name: 'Сайт',
                }),
                brand: new DealBrand({
                    id: 3,
                    fieldName: 'UF_CRM_BRAND',
                    value: 'Apple',
                    sort: 1,
                }),
                deviceType: new DealDeviceType({
                    id: 5,
                    name: 'Смартфон',
                }),
            },
        });
    }

    it('возвращает total и корректно мапит вложенные поля (stage/assignedBy/pointOfContact/leadSource/brand/deviceType)', async () => {
        const createdAt = new Date('2026-01-15T10:00:00.000Z');
        const updatedAt = new Date('2026-01-16T10:00:00.000Z');
        seededDeals = [
            buildDeal({ id: '101', createdAt, updatedAt }),
            buildDeal({ id: '102', createdAt, updatedAt }),
        ];

        const response = await request(app.getHttpServer())
            .get('/v1/service/sales/deals')
            .query({ from: '2026-01-01', to: '2026-01-31' })
            .expect(200);

        const body = response.body as ListDealsResponse;
        expect(body.total).toBe(2);
        expect(body.deals).toHaveLength(2);

        const first = body.deals[0];
        expect(first).toMatchObject({
            id: 101,
            title: 'Ремонт iPhone 13',
            opportunity: 15_000,
            categoryId: 0,
            deviceModel: 'iPhone 13',
            deviceMalfunction: 'Не включается',
            stage: {
                id: 'C1:WON',
                name: 'Сделка успешна',
                sort: 100,
                color: '#00ff00',
                systemType: 'SUCCESS',
                stageGroupId: 'grp-1',
                stageGroupName: 'Завершено',
            },
            assignedBy: { id: 42, firstName: 'Иван', lastName: 'Петров' },
            pointOfContact: { id: 'poc-1', name: 'Клиент', sort: 1 },
            leadSource: { id: 7, name: 'Сайт' },
            brand: {
                id: 3,
                fieldName: 'UF_CRM_BRAND',
                value: 'Apple',
                sort: 1,
            },
            deviceType: { id: 5, name: 'Смартфон' },
        });
        expect(new Date(first.createdAt).toISOString()).toBe(
            createdAt.toISOString(),
        );
        expect(
            new Date(first.updatedAt as unknown as string).toISOString(),
        ).toBe(updatedAt.toISOString());
    });

    it('корректно отдаёт null для пустых вложенных связей (nullable stage/assignedBy/...)', async () => {
        const createdAt = new Date('2026-02-01T00:00:00.000Z');
        seededDeals = [
            new DealListItemEntity({
                id: '200',
                createdAt,
                updatedAt: createdAt,
                props: {
                    title: null,
                    opportunity: null,
                    categoryId: 0,
                    deviceModel: null,
                    deviceMalfunction: null,
                    stage: null,
                    assignedBy: null,
                    pointOfContact: null,
                    leadSource: null,
                    brand: null,
                    deviceType: null,
                },
            }),
        ];

        const response = await request(app.getHttpServer())
            .get('/v1/service/sales/deals')
            .query({ from: '2026-02-01', to: '2026-02-28' })
            .expect(200);

        const body = response.body as ListDealsResponse;
        expect(body.total).toBe(1);
        expect(body.deals[0]).toMatchObject({
            id: 200,
            title: null,
            opportunity: null,
            deviceModel: null,
            deviceMalfunction: null,
            stage: null,
            assignedBy: null,
            pointOfContact: null,
            leadSource: null,
            brand: null,
            deviceType: null,
        });
    });

    it('передаёт распарсенный DateRange в порт репозитория (from/to из query)', async () => {
        seededDeals = [];

        await request(app.getHttpServer())
            .get('/v1/service/sales/deals')
            .query({ from: '2026-03-01', to: '2026-03-31' })
            .expect(200);

        expect(capturedRange).not.toBeNull();
        expect(capturedRange!.getFrom().toISOString()).toBe(
            '2026-03-01T00:00:00.000Z',
        );
        expect(capturedRange!.getTo().toISOString()).toBe(
            '2026-03-31T00:00:00.000Z',
        );
    });

    it('возвращает пустой список с total: 0, когда за период нет сделок', async () => {
        seededDeals = [];

        const response = await request(app.getHttpServer())
            .get('/v1/service/sales/deals')
            .query({ from: '2026-04-01', to: '2026-04-30' })
            .expect(200);

        expect(response.body).toEqual({ total: 0, deals: [] });
    });

    // Наблюдаемое поведение (400 на некорректный ввод) совпадает с легаси
    // DealsController.getDeals (src/TODO/deals/deals.controller.ts), хотя
    // внутренний механизм другой: там — ручные BadRequestException в
    // контроллере, здесь — ZodValidationPipe (отсутствие/пустая строка
    // from/to) или DateRange.create + DomainExceptionFilter (невалидный
    // формат/порядок дат).
    it('400 когда query-параметр from отсутствует', async () => {
        await request(app.getHttpServer())
            .get('/v1/service/sales/deals')
            .query({ to: '2026-01-31' })
            .expect(400);
    });

    it('400 когда query-параметр to отсутствует', async () => {
        await request(app.getHttpServer())
            .get('/v1/service/sales/deals')
            .query({ from: '2026-01-01' })
            .expect(400);
    });

    it('400 когда from и to пустые строки', async () => {
        await request(app.getHttpServer())
            .get('/v1/service/sales/deals')
            .query({ from: '', to: '' })
            .expect(400);
    });

    it('400 при невалидном формате даты', async () => {
        await request(app.getHttpServer())
            .get('/v1/service/sales/deals')
            .query({ from: 'not-a-date', to: '2026-01-31' })
            .expect(400);
    });

    it('400 когда from позже to', async () => {
        await request(app.getHttpServer())
            .get('/v1/service/sales/deals')
            .query({ from: '2026-02-01', to: '2026-01-01' })
            .expect(400);
    });
});
