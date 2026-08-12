import type { Server } from 'http';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type { GetServiceFunnelReportResponse } from 'ireports-contracts';
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
import { FUNNEL_DEAL_REPOSITORY } from '@/domains/service/modules/sales/application/ports/funnel-deal.port';
import type {
    FunnelDealRepositoryPort,
    ServiceFunnelFilter,
} from '@/domains/service/modules/sales/application/ports/funnel-deal.port';
import { UNIT_OF_WORK } from '@/shared/application/ports/unit-of-work.port';
import type { UnitOfWorkPort } from '@/shared/application/ports/unit-of-work.port';
import { DealListItemEntity } from '@/domains/service/modules/sales/domain/entities/deal-list-item.entity';
import { DealListStage } from '@/domains/service/modules/sales/domain/value-objects/deal-list-stage.value-object';
import { DomainExceptionFilter } from '@/shared/exceptions';
import { serviceFunnelKPICalculation } from '@/TODO/reports/reports.helpers';

// Тот же приём, что list-deals.e2e.spec.ts (см. комментарий там): поднимает
// SalesModule целиком через Nest TestingModule (реальные Controller →
// GetServiceFunnelReportService → FunnelDealRepositoryPort), подменяя
// только границу с БД. LEAD_REPOSITORY/SALES_PLAN_REPOSITORY/
// SALES_PLAN_TEMPLATE_REPOSITORY/SERVICE_SALES_FACT_SOURCE/
// DEAL_LIST_REPOSITORY подменяются заглушками по той же причине, что и там
// — они не участвуют в сценариях этого файла.
describe('GET /v1/service/sales/funnel-report (e2e)', () => {
    let app: INestApplication<Server>;

    let seededDeals: DealListItemEntity[] = [];
    let capturedFilter: ServiceFunnelFilter | null = null;

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

    const fakeFunnelDealRepo: FunnelDealRepositoryPort = {
        findByFilter: (filter) => {
            capturedFilter = filter;
            return Promise.resolve(seededDeals);
        },
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
        seededDeals = [];
        capturedFilter = null;
    });

    // Строит DealListItemEntity ровно так, как это делал бы реальный
    // DealListItemMapper.toDomain из строки bitrix_deals (см.
    // infrastructure/mappers/deal-list-item.mapper.ts).
    function buildDeal(overrides: {
        id: string;
        stageId: string;
        opportunity: number | null;
    }): DealListItemEntity {
        const now = new Date('2026-01-15T10:00:00.000Z');
        return new DealListItemEntity({
            id: overrides.id,
            createdAt: now,
            updatedAt: now,
            props: {
                title: 'Ремонт iPhone 13',
                opportunity: overrides.opportunity,
                categoryId: 0,
                deviceModel: 'iPhone 13',
                deviceMalfunction: 'Не включается',
                stage: new DealListStage({
                    id: overrides.stageId,
                    name: overrides.stageId,
                    sort: 100,
                    color: '#00ff00',
                    systemType: 'SUCCESS',
                    stageGroupId: null,
                    stageGroupName: null,
                }),
                assignedBy: null,
                pointOfContact: null,
                leadSource: null,
                brand: null,
                deviceType: null,
            },
        });
    }

    // Паритет с легаси ReportsService.getServiceFunnelReport
    // (src/TODO/reports/reports.service.ts, см. "Когда готово" Фазы 4:
    // "KPI на одинаковой выборке сделок совпадает с legacy-расчётом") —
    // проверяется напрямую вызовом легаси serviceFunnelKPICalculation на
    // той же выборке сделок, что отдаёт фейковый порт, а не только
    // сравнением с посчитанными вручную числами.
    it('KPI нового эндпоинта совпадает с легаси serviceFunnelKPICalculation на той же выборке', async () => {
        seededDeals = [
            buildDeal({ id: '1', stageId: 'WON', opportunity: 15_000 }),
            buildDeal({ id: '2', stageId: 'WON', opportunity: 25_000 }),
            buildDeal({ id: '3', stageId: 'LOSE', opportunity: 5_000 }),
            buildDeal({ id: '4', stageId: 'NEW', opportunity: 10_000 }),
            buildDeal({ id: '5', stageId: 'EXECUTING', opportunity: 12_000 }),
            buildDeal({ id: '6', stageId: 'UC_UPDA02', opportunity: 8_000 }),
            buildDeal({ id: '7', stageId: '3', opportunity: 1_000 }),
        ];

        const response = await request(app.getHttpServer())
            .get('/v1/service/sales/funnel-report')
            .query({ from: '2026-01-01', to: '2026-01-31' })
            .expect(200);

        const body = response.body as GetServiceFunnelReportResponse;

        const legacyKpi = serviceFunnelKPICalculation(
            seededDeals.map((deal) => {
                const props = deal.getProps();
                return {
                    stage: props.stage ? { id: props.stage.getId() } : null,
                    opportunity: props.opportunity,
                };
            }),
        );

        expect(body.KPI).toEqual(legacyKpi);
        expect(body.deals).toHaveLength(7);
    });

    it('передаёт все фильтры (dates + id-массивы) в порт репозитория', async () => {
        seededDeals = [];

        await request(app.getHttpServer())
            .get('/v1/service/sales/funnel-report')
            .query({
                from: '2026-02-01',
                to: '2026-02-28',
                sourceIds: ['1', '2'],
                managerIds: ['10'],
                modelIds: ['3', '4', '5'],
                stageIds: ['NEW', 'WON'],
                stageGroupIds: ['grp-1'],
            })
            .expect(200);

        expect(capturedFilter).not.toBeNull();
        expect(capturedFilter!.range.getFrom().toISOString()).toBe(
            '2026-02-01T00:00:00.000Z',
        );
        expect(capturedFilter!.range.getTo().toISOString()).toBe(
            '2026-02-28T00:00:00.000Z',
        );
        expect(capturedFilter!.sourceIds).toEqual([1, 2]);
        expect(capturedFilter!.managerIds).toEqual([10]);
        expect(capturedFilter!.modelIds).toEqual([3, 4, 5]);
        expect(capturedFilter!.stageIds).toEqual(['NEW', 'WON']);
        expect(capturedFilter!.stageGroupIds).toEqual(['grp-1']);
    });

    it('id-фильтры по умолчанию пустые массивы, когда query-параметры не переданы', async () => {
        seededDeals = [];

        await request(app.getHttpServer())
            .get('/v1/service/sales/funnel-report')
            .query({ from: '2026-03-01', to: '2026-03-31' })
            .expect(200);

        expect(capturedFilter!.sourceIds).toEqual([]);
        expect(capturedFilter!.managerIds).toEqual([]);
        expect(capturedFilter!.modelIds).toEqual([]);
        expect(capturedFilter!.stageIds).toEqual([]);
        expect(capturedFilter!.stageGroupIds).toEqual([]);
    });

    it('возвращает пустой список и нулевой KPI, когда за период нет сделок', async () => {
        seededDeals = [];

        const response = await request(app.getHttpServer())
            .get('/v1/service/sales/funnel-report')
            .query({ from: '2026-04-01', to: '2026-04-30' })
            .expect(200);

        const body = response.body as GetServiceFunnelReportResponse;
        expect(body.deals).toEqual([]);
        expect(body.KPI.allLeads).toBe(0);
        expect(body.KPI.conversionRate).toBe(0);
        expect(body.KPI.avgDeal).toBe(0);
    });

    // Наблюдаемое поведение (400 на некорректный ввод) совпадает с легаси
    // ReportsController.getServiceFunnelReport, хотя внутренний механизм
    // другой — см. тот же комментарий в list-deals.e2e.spec.ts.
    it('400 когда query-параметр from отсутствует', async () => {
        await request(app.getHttpServer())
            .get('/v1/service/sales/funnel-report')
            .query({ to: '2026-01-31' })
            .expect(400);
    });

    it('400 при невалидном формате даты', async () => {
        await request(app.getHttpServer())
            .get('/v1/service/sales/funnel-report')
            .query({ from: 'not-a-date', to: '2026-01-31' })
            .expect(400);
    });

    it('400 когда from позже to', async () => {
        await request(app.getHttpServer())
            .get('/v1/service/sales/funnel-report')
            .query({ from: '2026-02-01', to: '2026-01-01' })
            .expect(400);
    });
});
