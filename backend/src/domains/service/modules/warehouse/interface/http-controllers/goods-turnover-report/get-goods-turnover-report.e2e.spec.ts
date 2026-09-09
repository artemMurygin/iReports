import type { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RequestContextMiddleware } from 'nestjs-request-context';
import request from 'supertest';
import type { GetGoodsTurnoverReportResponse } from 'ireports-contracts';
import { GetGoodsTurnoverReportHttpController } from './get-goods-turnover-report.http.controller';
import { GetGoodsTurnoverReportService } from '@/domains/service/modules/warehouse/application/services/goods-turnover-report/get-goods-turnover-report.service';
import { GOODS_TURNOVER_REPORT_LINE_REPOSITORY } from '@/domains/service/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report-line.port';
import type { GoodsTurnoverReportLineRepositoryPort } from '@/domains/service/modules/warehouse/application/ports/goods-turnover-report/goods-turnover-report-line.port';
import { PRODUCT_CATEGORY_REPOSITORY } from '@/domains/service/modules/warehouse/application/ports/product-category/product-category.port';
import type { ProductCategoryRepositoryPort } from '@/domains/service/modules/warehouse/application/ports/product-category/product-category.port';
import { WAREHOUSE_REPOSITORY } from '@/domains/service/modules/warehouse/application/ports/warehouse/warehouse.port';
import type { WarehouseRepositoryPort } from '@/domains/service/modules/warehouse/application/ports/warehouse/warehouse.port';
import { GoodsTurnoverReportLine } from '@/domains/service/modules/warehouse/domain/entities/goods-turnover-report/goods-turnover-report-line.entity';
import { GoodsFlowMetric } from '@/domains/service/modules/warehouse/domain/value-objects/goods-flow-metric.value-object';
import { ProductCategory } from '@/domains/service/modules/warehouse/domain/value-objects/product-category.value-object';
import { Warehouse } from '@/domains/service/modules/warehouse/domain/value-objects/warehouse.value-object';
import { DomainExceptionFilter } from '@/shared/exceptions';

// Задача 10.7 — по образцу modules/reports/interface/http-controllers/
// reports.e2e.spec.ts: поднимает реальный Controller → Service поверх Nest
// TestingModule, подменяя только три порта репозиториев (`useValue`) —
// WarehouseModule (задача 13) ещё не существует, поэтому вместо импорта
// модуля контроллер и сервис регистрируются explicit `controllers`/
// `providers`, тем же приёмом, что Nest допускает для точечного e2e без
// поднятия всего модуля.
describe('GET /v1/service/warehouse/goods-turnover-report/:period (e2e)', () => {
    let app: INestApplication<Server>;

    let seededLines: GoodsTurnoverReportLine[] = [];
    let seededCategories: ProductCategory[] = [];
    let seededWarehouses: Warehouse[] = [];
    let capturedPeriod: string | null = null;

    const fakeLineRepo: GoodsTurnoverReportLineRepositoryPort = {
        findByPeriod: (period) => {
            capturedPeriod = period;
            return Promise.resolve(seededLines);
        },
        replaceAll: () => Promise.resolve(),
    };
    const fakeCategoryRepo: ProductCategoryRepositoryPort = {
        findAll: () => Promise.resolve(seededCategories),
    };
    const fakeWarehouseRepo: WarehouseRepositoryPort = {
        findAll: () => Promise.resolve(seededWarehouses),
    };

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [GetGoodsTurnoverReportHttpController],
            providers: [
                GetGoodsTurnoverReportService,
                {
                    provide: GOODS_TURNOVER_REPORT_LINE_REPOSITORY,
                    useValue: fakeLineRepo,
                },
                {
                    provide: PRODUCT_CATEGORY_REPOSITORY,
                    useValue: fakeCategoryRepo,
                },
                { provide: WAREHOUSE_REPOSITORY, useValue: fakeWarehouseRepo },
            ],
        }).compile();

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
        seededLines = [];
        seededCategories = [];
        seededWarehouses = [];
        capturedPeriod = null;
    });

    it('строки периода + справочники категорий/складов → денормализованная форма ответа', async () => {
        const line = GoodsTurnoverReportLine.create({
            period: '2026-01',
            categoryId: 10,
            warehouseId: 1,
            outcome: GoodsFlowMetric.create(5, 5000),
            stock: GoodsFlowMetric.create(2, 2000),
        });
        line.calcRatio(3000);
        seededLines = [line];
        seededCategories = [
            ProductCategory.create({
                id: 10,
                name: 'Аккумуляторы',
                parentId: 1,
            }),
        ];
        seededWarehouses = [
            Warehouse.create({ id: 1, name: 'Основной склад' }),
        ];

        const response = await request(app.getHttpServer())
            .get('/v1/service/warehouse/goods-turnover-report/2026-01')
            .expect(200);

        const body = response.body as GetGoodsTurnoverReportResponse;
        expect(body).toEqual({
            period: '2026-01',
            lines: [
                {
                    categoryId: 10,
                    categoryName: 'Аккумуляторы',
                    categoryParentId: 1,
                    warehouseId: 1,
                    warehouseName: 'Основной склад',
                    outcomeQuantity: 5,
                    outcomeSum: 5000,
                    stockQuantity: 2,
                    stockSum: 2000,
                    turnoverRatio: 2,
                },
            ],
        });
        expect(capturedPeriod).toBe('2026-01');
    });

    it('период без сохранённых строк — пустой список, не ошибка (состояние «отчёт ещё не пересчитан»)', async () => {
        seededLines = [];

        const response = await request(app.getHttpServer())
            .get('/v1/service/warehouse/goods-turnover-report/2026-02')
            .expect(200);

        expect(response.body).toEqual({ period: '2026-02', lines: [] });
    });

    it('400 при невалидном формате периода', async () => {
        await request(app.getHttpServer())
            .get('/v1/service/warehouse/goods-turnover-report/not-a-period')
            .expect(400);
    });
});
