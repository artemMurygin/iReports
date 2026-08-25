import type { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type {
    GetServicesAnalyticsResponse,
    ListServiceCategoriesResponse,
} from 'ireports-contracts';
import { ReportsModule } from '@/domains/service/modules/reports/reports.module';
import { SERVICE_SALES_SOURCE } from '@/domains/service/modules/reports/application/ports/service-sales.port';
import type {
    ServiceSalesFilter,
    ServiceSalesSourcePort,
} from '@/domains/service/modules/reports/application/ports/service-sales.port';
import { ServiceSaleEntity } from '@/domains/service/modules/reports/domain/entities/service-sale.entity';
import { ServiceCategory } from '@/domains/service/modules/reports/domain/value-objects/service-category.value-object';
import { DomainExceptionFilter } from '@/shared/exceptions';

// Поднимает ReportsModule целиком через Nest TestingModule (реальные
// Controller → Service → ServiceSalesSourcePort), подменяя только границу с
// БД — тот же приём, что list-deals.e2e.spec.ts/
// get-service-funnel-report.e2e.spec.ts в modules/sales. В отличие от тех
// файлов, здесь только один порт (SERVICE_SALES_SOURCE) — модуль reports не
// делит инфраструктуру ни с чем другим, поэтому не нужен ни
// FakeInfrastructureModule/UNIT_OF_WORK (ServiceSalesRepository, реальная
// реализация порта, не инстанцируется вовсе — провайдер целиком подменён
// fakeSource), ни другие заглушки.
describe('domains/service/modules/reports (e2e)', () => {
    let app: INestApplication<Server>;

    let seededRows: ServiceSaleEntity[] = [];
    let seededCategories: ServiceCategory[] = [];
    let capturedFilter: ServiceSalesFilter | null = null;

    const fakeSource: ServiceSalesSourcePort = {
        findByFilter: (filter) => {
            capturedFilter = filter;
            return Promise.resolve(seededRows);
        },
        listCategories: () => Promise.resolve(seededCategories),
    };

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [ReportsModule],
        })
            .overrideProvider(SERVICE_SALES_SOURCE)
            .useValue(fakeSource)
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
        seededRows = [];
        seededCategories = [];
        capturedFilter = null;
    });

    // Строит ServiceSaleEntity ровно так, как это делал бы реальный
    // ServiceSalesRepository.findByFilter из строки roapp_service_orders
    // (см. infrastructure/repositories/service-sales.repository.ts).
    function buildRow(overrides: {
        id: string;
        serviceId: number;
        serviceName: string;
        categoryId: number | null;
        retailPrice: number;
        orderId: number;
        quantity: number;
        price: number;
        engineerSalary: number;
        closedAt: Date;
        orderPayed: number;
        orderCost: number;
    }): ServiceSaleEntity {
        return new ServiceSaleEntity({
            id: overrides.id,
            props: {
                serviceId: overrides.serviceId,
                serviceName: overrides.serviceName,
                categoryId: overrides.categoryId,
                retailPrice: overrides.retailPrice,
                orderId: overrides.orderId,
                quantity: overrides.quantity,
                price: overrides.price,
                engineerSalary: overrides.engineerSalary,
                closedAt: overrides.closedAt,
                orderPayed: overrides.orderPayed,
                orderCost: overrides.orderCost,
            },
        });
    }

    describe('GET /v1/service/reports/services', () => {
        it('группирует по услуге, дедуплицирует заказы для avgOrderCheck/totalRevenue и строит breakdown по дням', async () => {
            seededRows = [
                // Услуга 1: два ряда в одном заказе (100) + один ряд в другом (101).
                buildRow({
                    id: '1',
                    serviceId: 1,
                    serviceName: 'Замена экрана',
                    categoryId: 10,
                    retailPrice: 1500,
                    orderId: 100,
                    quantity: 1,
                    price: 1000,
                    engineerSalary: 200,
                    closedAt: new Date('2026-01-01T10:00:00.000Z'),
                    orderPayed: 5000,
                    orderCost: 2000,
                }),
                buildRow({
                    id: '2',
                    serviceId: 1,
                    serviceName: 'Замена экрана',
                    categoryId: 10,
                    retailPrice: 1500,
                    orderId: 100,
                    quantity: 1,
                    price: 1200,
                    engineerSalary: 250,
                    closedAt: new Date('2026-01-01T11:00:00.000Z'),
                    orderPayed: 5000,
                    orderCost: 2000,
                }),
                buildRow({
                    id: '3',
                    serviceId: 1,
                    serviceName: 'Замена экрана',
                    categoryId: 10,
                    retailPrice: 1500,
                    orderId: 101,
                    quantity: 1,
                    price: 900,
                    engineerSalary: 90,
                    closedAt: new Date('2026-01-02T08:00:00.000Z'),
                    orderPayed: 3000,
                    orderCost: 1500,
                }),
                // Услуга 2: одна строка, отдельный заказ.
                buildRow({
                    id: '4',
                    serviceId: 2,
                    serviceName: 'Диагностика',
                    categoryId: 20,
                    retailPrice: 0,
                    orderId: 102,
                    quantity: 2,
                    price: 0,
                    engineerSalary: 0,
                    closedAt: new Date('2026-01-01T09:00:00.000Z'),
                    orderPayed: 0,
                    orderCost: 0,
                }),
            ];

            const response = await request(app.getHttpServer())
                .get('/v1/service/reports/services')
                .query({ from: '2026-01-01', to: '2026-01-02', groupBy: 'day' })
                .expect(200);

            const body = response.body as GetServicesAnalyticsResponse;
            expect(body.services).toHaveLength(2);

            const service1 = body.services.find((s) => s.serviceId === 1);
            expect(service1).toMatchObject({
                serviceId: 1,
                serviceName: 'Замена экрана',
                categoryId: 10,
                retailPrice: 1500,
                totalCount: 3,
                // Уникальные заказы: (5000,2000) и (3000,1500)
                totalRevenue: 8000,
                totalProfit: 4500,
                totalEngineerBonus: 540,
                // avgServicePrice = round((1000+1200+900)/3) = 1033
                avgServicePrice: 1033,
                avgOrderCheck: 4000,
            });
            expect(service1!.breakdown).toEqual([
                { period: '2026-01-01', count: 2, avgPrice: 1100 },
                { period: '2026-01-02', count: 1, avgPrice: 900 },
            ]);

            const service2 = body.services.find((s) => s.serviceId === 2);
            expect(service2).toMatchObject({
                serviceId: 2,
                serviceName: 'Диагностика',
                categoryId: 20,
                totalCount: 2,
                totalRevenue: 0,
                totalProfit: 0,
            });
        });

        it('пустая выборка даёт пустой список услуг', async () => {
            seededRows = [];

            const response = await request(app.getHttpServer())
                .get('/v1/service/reports/services')
                .query({ from: '2026-01-01', to: '2026-01-31' })
                .expect(200);

            expect(response.body).toEqual({ services: [] });
        });

        it('передаёт диапазон дат и id-фильтры в порт, groupBy по умолчанию — day', async () => {
            seededRows = [];

            await request(app.getHttpServer())
                .get('/v1/service/reports/services')
                .query({
                    from: '2026-02-01',
                    to: '2026-02-28',
                    categoryIds: ['10', '20'],
                    serviceIds: ['1'],
                })
                .expect(200);

            expect(capturedFilter).not.toBeNull();
            expect(capturedFilter!.range.getFrom().toISOString()).toBe(
                '2026-02-01T00:00:00.000Z',
            );
            expect(capturedFilter!.range.getTo().toISOString()).toBe(
                '2026-02-28T00:00:00.000Z',
            );
            expect(capturedFilter!.categoryIds).toEqual([10, 20]);
            expect(capturedFilter!.serviceIds).toEqual([1]);
        });

        it('id-фильтры по умолчанию пустые массивы, когда query-параметры не переданы', async () => {
            seededRows = [];

            await request(app.getHttpServer())
                .get('/v1/service/reports/services')
                .query({ from: '2026-03-01', to: '2026-03-31' })
                .expect(200);

            expect(capturedFilter!.categoryIds).toEqual([]);
            expect(capturedFilter!.serviceIds).toEqual([]);
        });

        it('400 когда query-параметр from отсутствует', async () => {
            await request(app.getHttpServer())
                .get('/v1/service/reports/services')
                .query({ to: '2026-01-31' })
                .expect(400);
        });

        it('400 при невалидном формате даты', async () => {
            await request(app.getHttpServer())
                .get('/v1/service/reports/services')
                .query({ from: 'not-a-date', to: '2026-01-31' })
                .expect(400);
        });

        it('400 когда from позже to', async () => {
            await request(app.getHttpServer())
                .get('/v1/service/reports/services')
                .query({ from: '2026-02-01', to: '2026-01-01' })
                .expect(400);
        });
    });

    describe('GET /v1/service/reports/service-categories', () => {
        it('возвращает плоский список категорий как есть (без параметров)', async () => {
            seededCategories = [
                ServiceCategory.create({
                    id: 1,
                    name: 'Ремонт',
                    parentId: null,
                    depth: 0,
                }),
                ServiceCategory.create({
                    id: 2,
                    name: 'Замена экрана',
                    parentId: 1,
                    depth: 1,
                }),
            ];

            const response = await request(app.getHttpServer())
                .get('/v1/service/reports/service-categories')
                .expect(200);

            const body = response.body as ListServiceCategoriesResponse;
            expect(body).toEqual([
                { id: 1, name: 'Ремонт', parentId: null, depth: 0 },
                { id: 2, name: 'Замена экрана', parentId: 1, depth: 1 },
            ]);
        });

        it('возвращает пустой список, когда категорий нет', async () => {
            seededCategories = [];

            const response = await request(app.getHttpServer())
                .get('/v1/service/reports/service-categories')
                .expect(200);

            expect(response.body).toEqual([]);
        });
    });
});
